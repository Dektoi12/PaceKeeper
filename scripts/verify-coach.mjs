// Verifies Phase 6: recap rendering, the adaptive engine, the offline FAQ, and
// JSON backup round-trip (against in-memory IndexedDB).
//
//   npm install --no-save fake-indexeddb && node scripts/verify-coach.mjs

import 'fake-indexeddb/auto'
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const entry = `
export { buildWeekSummary, renderRecap } from '@/services/coach/recap'
export { proposeAdaptation } from '@/services/coach/adapt'
export { answerFaq } from '@/services/coach/faq'
export { exportAll, importAll } from '@/services/db/backup'
export { db } from '@/services/db/db'
`
const tmp = mkdtempSync(join(tmpdir(), 'pk-coach-'))
const entryPath = join(tmp, 'entry.ts')
writeFileSync(entryPath, entry)
const out = await build({
  entryPoints: [entryPath], bundle: true, format: 'esm', platform: 'node', write: false,
  alias: { '@': resolve(root, 'src') },
})
const modPath = join(tmp, 'bundle.mjs')
writeFileSync(modPath, out.outputFiles[0].text)
const m = await import(pathToFileURL(modPath).href)

let passed = 0
const check = async (name, fn) => { await fn(); passed++; console.log(`  ok  ${name}`) }

const sess = (o) => ({
  id: o.id, planId: 'p', date: o.date, weekNumber: 0, dayOfWeek: 0,
  type: o.type ?? 'easy', title: o.title ?? 'Run', description: '', steps: [],
  status: o.status ?? 'upcoming', plannedDistanceKm: o.plannedDistanceKm,
  linkedRunId: o.linkedRunId,
})
const run = (o) => ({
  id: o.id, date: o.date, source: 'manual', distanceKm: o.distanceKm,
  durationSec: o.durationSec, avgPaceSecPerKm: o.durationSec / o.distanceKm,
  feel: o.feel, createdAt: 0, splits: o.splits,
})

// --- recap ---
await check('renderRecap summarises sessions, mileage, and feel', () => {
  const sessions = [sess({ id: 'a', date: '2026-06-01', status: 'completed', plannedDistanceKm: 5 }), sess({ id: 'b', date: '2026-06-03', status: 'completed', plannedDistanceKm: 8 })]
  const runs = [run({ id: 'r1', date: '2026-06-01', distanceKm: 5, durationSec: 1500, feel: 4 })]
  const summary = m.buildWeekSummary('2026-06-01', sessions, runs)
  assert.equal(summary.plannedSessions, 2)
  assert.equal(summary.completedSessions, 2)
  const text = m.renderRecap(summary, { prevActualKm: 3, focus: 'ease next week' })
  assert.match(text, /every planned session/)
  assert.match(text, /Focus for next week/)
})

// --- adaptation: reduce ---
await check('proposeAdaptation reduces after ≥2 missed sessions', () => {
  const lastWeek = [
    sess({ id: 'm1', date: '2026-06-01', type: 'easy', status: 'skipped', plannedDistanceKm: 5 }),
    sess({ id: 'm2', date: '2026-06-03', type: 'tempo', status: 'skipped', plannedDistanceKm: 8 }),
    sess({ id: 'm3', date: '2026-06-05', type: 'easy', status: 'completed', plannedDistanceKm: 5 }),
  ]
  const upcoming = [sess({ id: 'u1', date: '2026-06-08', type: 'easy', plannedDistanceKm: 10 })]
  const p = m.proposeAdaptation({ lastWeekSessions: lastWeek, upcomingSessions: upcoming, recentRuns: [] })
  assert.ok(p, 'has proposal')
  assert.equal(p.kind, 'reduce')
  assert.ok(p.changes[0].patch.plannedDistanceKm < 10, 'volume reduced')
  assert.equal(p.snapshot[0].patch.plannedDistanceKm, 10, 'snapshot keeps original')
})

// --- adaptation: recovery (struggling) ---
await check('proposeAdaptation softens quality when feel ≤ 2', () => {
  const lastWeek = [sess({ id: 'q', date: '2026-06-01', type: 'tempo', status: 'completed', plannedDistanceKm: 8, linkedRunId: 'rr' })]
  const runs = [run({ id: 'rr', date: '2026-06-01', distanceKm: 8, durationSec: 2400, feel: 1 })]
  const upcoming = [sess({ id: 'ni', date: '2026-06-08', type: 'intervals', plannedDistanceKm: 9 })]
  const p = m.proposeAdaptation({ lastWeekSessions: lastWeek, upcomingSessions: upcoming, recentRuns: runs })
  assert.ok(p && p.kind === 'recovery')
  assert.equal(p.changes[0].patch.type, 'easy')
})

// --- adaptation: step up (crushed) ---
await check('proposeAdaptation offers a step-up after a strong week', () => {
  const lastWeek = [
    sess({ id: 'c1', date: '2026-06-01', type: 'easy', status: 'completed', plannedDistanceKm: 5, linkedRunId: 'x1' }),
    sess({ id: 'c2', date: '2026-06-03', type: 'long', status: 'completed', plannedDistanceKm: 12, linkedRunId: 'x2' }),
  ]
  const runs = [run({ id: 'x1', date: '2026-06-01', distanceKm: 5, durationSec: 1500, feel: 5 }), run({ id: 'x2', date: '2026-06-03', distanceKm: 12, durationSec: 3600, feel: 4 })]
  const upcoming = [sess({ id: 'up', date: '2026-06-08', type: 'easy', plannedDistanceKm: 6 })]
  const p = m.proposeAdaptation({ lastWeekSessions: lastWeek, upcomingSessions: upcoming, recentRuns: runs })
  assert.ok(p && p.kind === 'stepUp' && p.offer === true)
  assert.ok(p.changes[0].patch.plannedDistanceKm > 6)
})

// --- FAQ ---
await check('answerFaq matches keywords and falls back', () => {
  assert.match(m.answerFaq('how hard should my easy runs be?'), /conversational/i)
  assert.match(m.answerFaq('what about tapering before a race'), /volume/i)
  assert.match(m.answerFaq('will it rain tomorrow'), /offline coach/i)
})

// --- backup round-trip ---
await check('exportAll → importAll restores every table', async () => {
  await m.db.profile.put({ id: 'me', name: 'Test', age: 30, units: 'km', preferredRunDays: [1, 3, 5], experience: 'intermediate', createdAt: 0, updatedAt: 0 })
  await m.db.runs.put(run({ id: 'br', date: '2026-06-01', distanceKm: 10, durationSec: 3000 }))
  const blob = await exportThenText(m)
  await m.db.profile.clear()
  await m.db.runs.clear()
  await m.importAll(blob)
  const prof = await m.db.profile.get('me')
  const runs = await m.db.runs.toArray()
  assert.equal(prof?.name, 'Test')
  assert.equal(runs.length, 1)
  const settings = await m.db.settings.get('app')
  assert.ok(settings?.lastBackupAt, 'lastBackupAt stamped on export')
})

async function exportThenText(m) {
  const blob = await m.exportAll()
  return await blob.text()
}

console.log(`\n${passed} checks passed.`)
await m.db.close()
