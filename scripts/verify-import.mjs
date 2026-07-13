// Pure-logic verification for the import pipeline, independent of the browser.
// Bundles the real source (polyline + preview) with esbuild (already installed
// via Vite) so we exercise the shipping code, not a reimplementation.
//
//   node scripts/verify-import.mjs

import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const entry = `
export { encode, decode } from '@/lib/polyline'
export { buildRunImport } from '@/services/importers/preview'
`
const tmp = mkdtempSync(join(tmpdir(), 'pk-verify-'))
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
const { encode, decode, buildRunImport } = await import(pathToFileURL(modPath).href)

let passed = 0
const check = (name, fn) => {
  fn()
  passed++
  console.log(`  ok  ${name}`)
}

// --- polyline round-trip ---
check('polyline round-trips lat/lng/ele within precision', () => {
  const track = [
    { lat: 51.5, lng: -0.12, ele: 10 },
    { lat: 51.503, lng: -0.1201, ele: 12.4 },
    { lat: 51.506, lng: -0.1203, ele: 16 },
  ]
  const back = decode(encode(track))
  assert.equal(back.length, track.length)
  for (let i = 0; i < track.length; i++) {
    assert.ok(Math.abs(back[i].lat - track[i].lat) < 1e-5)
    assert.ok(Math.abs(back[i].lng - track[i].lng) < 1e-5)
    assert.ok(Math.abs(back[i].ele - track[i].ele) < 1e-2)
  }
})

// --- buildRunImport: geometry-driven ---
// 6 points ~333 m apart northbound over 10m30s, elevation 10→20 with a dip.
const t0 = Date.parse('2026-07-13T06:00:00Z')
const points = [
  { lat: 51.5, lng: -0.12, ele: 10, hr: 128, time: t0 },
  { lat: 51.503, lng: -0.12, ele: 12, hr: 134, time: t0 + 120_000 },
  { lat: 51.506, lng: -0.12, ele: 16, hr: 140, time: t0 + 245_000 },
  { lat: 51.509, lng: -0.12, ele: 14, hr: 145, time: t0 + 370_000 },
  { lat: 51.512, lng: -0.12, ele: 18, hr: 149, time: t0 + 500_000 },
  { lat: 51.515, lng: -0.12, ele: 20, hr: 152, time: t0 + 630_000 },
]

check('derives a sane distance from geometry', () => {
  const r = buildRunImport('gpx', 'sample.gpx', points)
  // 5 segments × ~333 m ≈ 1.6–1.7 km.
  assert.ok(r.distanceKm > 1.5 && r.distanceKm < 1.8, `distanceKm=${r.distanceKm}`)
})

check('duration comes from first→last timestamp', () => {
  const r = buildRunImport('gpx', 'sample.gpx', points)
  assert.equal(r.durationSec, 630)
})

check('pace = duration / distance', () => {
  const r = buildRunImport('gpx', 'sample.gpx', points)
  assert.equal(r.avgPaceSecPerKm, Math.round(630 / r.distanceKm))
})

check('produces at least one per-km split', () => {
  const r = buildRunImport('gpx', 'sample.gpx', points)
  assert.ok(r.splits.length >= 1)
  assert.equal(r.splits[0].index, 1)
  assert.ok(r.splits[0].paceSecPerKm > 0)
})

check('avg/max HR aggregate from samples', () => {
  const r = buildRunImport('gpx', 'sample.gpx', points)
  assert.equal(r.maxHR, 152)
  assert.ok(r.avgHR >= 128 && r.avgHR <= 152)
})

check('elevation gain is positive and noise-tolerant', () => {
  const r = buildRunImport('gpx', 'sample.gpx', points)
  // Net climb ~10 m with one 2 m dip — gain should be positive, well under 20.
  assert.ok(r.elevationGainM > 0 && r.elevationGainM < 20, `gain=${r.elevationGainM}`)
})

check('date derives from first sample (local)', () => {
  const r = buildRunImport('gpx', 'sample.gpx', points)
  assert.match(r.date, /^\d{4}-\d{2}-\d{2}$/)
})

check('lap fallback when there is no geometry', () => {
  const laps = [{ distanceKm: 5, durationSec: 1500, avgHR: 150, maxHR: 165 }]
  const r = buildRunImport('tcx', 'nogeo.tcx', [], laps)
  assert.equal(r.totalsOnly, true)
  assert.equal(r.distanceKm, 5)
  assert.equal(r.durationSec, 1500)
  assert.equal(r.avgHR, 150)
  assert.equal(r.splits.length, 1)
})

console.log(`\n${passed} checks passed.`)
