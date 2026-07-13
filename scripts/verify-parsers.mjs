// Verifies the GPX/TCX DOM parsers against the fixture files, outside the
// browser. Uses `linkedom` for a DOMParser if available; skips gracefully
// otherwise (the parsers' real home is the browser — see the app's Log screen).
//
//   npm install --no-save linkedom && node scripts/verify-parsers.mjs

import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

let DOMParser
try {
  ;({ DOMParser } = await import('linkedom'))
} catch {
  console.log('linkedom not installed — skipping DOM parser checks.')
  console.log('Run: npm install --no-save linkedom && node scripts/verify-parsers.mjs')
  process.exit(0)
}
globalThis.DOMParser = DOMParser

const entry = `
export { parseGpx } from '@/services/importers/gpx'
export { parseTcx } from '@/services/importers/tcx'
`
const tmp = mkdtempSync(join(tmpdir(), 'pk-parsers-'))
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
const { parseGpx, parseTcx } = await import(pathToFileURL(modPath).href)

const fixtures = resolve(root, 'src/services/importers/__fixtures__')
const gpxXml = readFileSync(join(fixtures, 'sample.gpx'), 'utf8')
const tcxXml = readFileSync(join(fixtures, 'sample.tcx'), 'utf8')

let passed = 0
const check = (name, fn) => {
  fn()
  passed++
  console.log(`  ok  ${name}`)
}

const assertRun = (r, label) => {
  assert.ok(r.distanceKm > 1.5 && r.distanceKm < 1.8, `${label} distanceKm=${r.distanceKm}`)
  assert.equal(r.durationSec, 630, `${label} durationSec`)
  assert.ok(r.splits.length >= 1, `${label} splits`)
  assert.equal(r.maxHR, 152, `${label} maxHR`)
  assert.ok(r.avgHR >= 128 && r.avgHR <= 152, `${label} avgHR=${r.avgHR}`)
  assert.ok(r.elevationGainM > 0, `${label} elevationGainM=${r.elevationGainM}`)
  assert.equal(r.date, '2026-07-13', `${label} date`)
  assert.equal(r.track.length, 6, `${label} track length`)
}

check('parseGpx reads trkpt geometry, ele, time, and gpxtpx HR', () => {
  assertRun(parseGpx(gpxXml, 'sample.gpx'), 'gpx')
})

check('parseTcx reads Trackpoint geometry, altitude, and HeartRateBpm', () => {
  assertRun(parseTcx(tcxXml, 'sample.tcx'), 'tcx')
})

check('parseGpx rejects non-GPX input', () => {
  assert.throws(() => parseGpx('<html><body>nope</body></html>', 'x.gpx'))
})

console.log(`\n${passed} checks passed.`)
