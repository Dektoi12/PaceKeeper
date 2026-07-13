// Verifies the Phase 5 stats engine. Pure functions (predictor, streaks,
// trends, computePRs) run directly; the persistence path (upsertRecords,
// evaluateBadges) runs against an in-memory IndexedDB via `fake-indexeddb`.
//
//   npm install --no-save fake-indexeddb && node scripts/verify-stats.mjs

import 'fake-indexeddb/auto'
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const entry = `
export { computePRs, upsertRecords } from '@/services/stats/prs'
export { evaluateBadges } from '@/services/stats/badges'
export { predictRaces } from '@/services/stats/predictor'
export { computeWeeklyStreak } from '@/services/stats/streaks'
export { weeklyMileage, monthlyTotals, easyPaceTrend, consistencyHeatmap } from '@/services/stats/trends'
export { db } from '@/services/db/db'
`
const tmp = mkdtempSync(join(tmpdir(), 'pk-stats-'))
const entryPath = join(tmp, 'entry.ts')
writeFileSync(entryPath, entry)
const out = await build({
  entryPoints: [entryPath],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  alias: { '@': resolve(root, 'src') },
})
const modPath = join(tmp, 'bundle.mjs')
writeFileSync(modPath, out.outputFiles[0].text)
const m = await import(pathToFileURL(modPath).href)

let passed = 0
const check = (name, fn) => {
  const r = fn()
  if (r && typeof r.then === 'function') return r.then(() => { passed++; console.log(`  ok  ${name}`) })
  passed++
  console.log(`  ok  ${name}`)
}

const run = (over) => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  date: over.date,
  source: 'manual',
  distanceKm: over.distanceKm,
  durationSec: over.durationSec,
  avgPaceSecPerKm: over.durationSec / over.distanceKm,
  createdAt: over.createdAt ?? Date.parse(over.date + 'T12:00:00Z'),
  ...over,
})

// --- computePRs ---
await check('computePRs picks fastest 5K (normalized) + longest run', () => {
  const runs = [
    run({ id: 'a', date: '2026-06-01', distanceKm: 5.02, durationSec: 25 * 60 }), // ~5:00/km
    run({ id: 'b', date: '2026-06-08', distanceKm: 4.98, durationSec: 22 * 60 }), // ~4:25/km faster
    run({ id: 'c', date: '2026-06-15', distanceKm: 18, durationSec: 100 * 60 }),
  ]
  const prs = m.computePRs(runs)
  const p5 = prs.find((p) => p.kind === 'fastest5k')
  assert.ok(p5, 'has 5k PR')
  assert.equal(p5.runId, 'b', 'fastest 5k is run b')
  const longest = prs.find((p) => p.kind === 'longestRun')
  assert.equal(longest.value, 18)
})

// --- upsertRecords persists + reports improvements ---
await check('upsertRecords writes records and reports new/improved kinds', async () => {
  await m.db.records.clear()
  const runs = [run({ id: 'x', date: '2026-06-01', distanceKm: 10.05, durationSec: 50 * 60 })]
  const first = await m.upsertRecords(runs)
  assert.ok(first.includes('fastest10k'), 'first pass sets 10k')
  const stored = await m.db.records.toArray()
  assert.ok(stored.find((r) => r.kind === 'fastest10k'))
  // Slower run should NOT improve.
  const again = await m.upsertRecords([...runs, run({ id: 'y', date: '2026-06-02', distanceKm: 10, durationSec: 55 * 60 })])
  assert.ok(!again.includes('fastest10k'), 'slower run does not beat PR')
  // Faster run improves.
  const faster = await m.upsertRecords([...runs, run({ id: 'z', date: '2026-06-03', distanceKm: 10, durationSec: 45 * 60 })])
  assert.ok(faster.includes('fastest10k'), 'faster run beats PR')
})

// --- evaluateBadges ---
await check('evaluateBadges unlocks distance badges idempotently', async () => {
  await m.db.achievements.clear()
  const runs = [run({ id: 'r1', date: '2026-06-01', distanceKm: 10.2, durationSec: 55 * 60 })]
  const first = await m.evaluateBadges(runs, [])
  const ids = first.map((b) => b.id)
  assert.ok(ids.includes('first-run') && ids.includes('five-k') && ids.includes('ten-k'), `got ${ids}`)
  const second = await m.evaluateBadges(runs, [])
  assert.equal(second.length, 0, 'no re-unlock on second pass')
})

// --- predictor ---
check('predictRaces orders predictions and computes goal gap', () => {
  const runs = [run({ id: 'p', date: '2026-07-01', distanceKm: 5, durationSec: 22 * 60 })]
  const goal = { id: 'g', type: '10k', targetTime: 44 * 60, status: 'active', createdAt: 0 }
  const pred = m.predictRaces(runs, goal)
  assert.ok(pred, 'has prediction')
  const t5 = pred.predictions.find((p) => p.label === '5K').timeSec
  const t10 = pred.predictions.find((p) => p.label === '10K').timeSec
  assert.ok(t10 > t5, '10k slower than 5k')
  assert.ok(pred.goal && typeof pred.goal.gapSec === 'number')
})

// --- streaks ---
check('computeWeeklyStreak counts ≥75% weeks', () => {
  const s = (date, status) => ({ id: date + status, planId: 'p', date, weekNumber: 0, dayOfWeek: 0, type: 'easy', title: '', description: '', steps: [], status })
  const sessions = [
    // Week A: 2/2 completed → hit
    s('2026-06-01', 'completed'), s('2026-06-03', 'completed'),
    // Week B: 1/2 completed → miss (50%)
    s('2026-06-08', 'completed'), s('2026-06-10', 'upcoming'),
  ]
  const res = m.computeWeeklyStreak(sessions)
  assert.equal(res.longest, 1)
  assert.equal(res.current, 0, 'current is 0 because latest week missed')
})

// --- trends ---
check('weeklyMileage + monthlyTotals aggregate correctly', () => {
  const runs = [
    run({ date: '2026-07-06', distanceKm: 5, durationSec: 1500 }),
    run({ date: '2026-07-08', distanceKm: 3, durationSec: 900 }),
  ]
  const monthly = m.monthlyTotals(runs)
  assert.equal(monthly.find((x) => x.month === '2026-07').km, 8)
  const heat = m.consistencyHeatmap(runs, 30)
  assert.equal(heat.length, 30)
})

console.log(`\n${passed} checks passed.`)
await m.db.close()
