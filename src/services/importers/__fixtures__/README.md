# Import test fixtures

Small, valid sample activity files for exercising the GPX / TCX / FIT importers.

- `sample.gpx` — GPX 1.1 with 6 trackpoints (lat/lng/ele/time + `gpxtpx:hr` HR extension). ~1.67 km over 10m30s.
- `sample.tcx` — TCX with a single `<Lap>` (distance/time/HR summary) wrapping the same 6 trackpoints.

## Testing with a real export

Drop your own watch export here (or pick it straight from the Log → **Import file** tab):

- **Zepp / Amazfit** → export as GPX or TCX from the app.
- **Garmin** → export the original `.fit`, or GPX from Garmin Connect.
- **Strava** → "Export GPX" / "Export original".

Then in the running app: **Log → Import file → Choose file**. You should see a preview
(distance, time, pace, HR, elevation, split count) before saving, and — for files with a
GPS track — a route map + elevation profile on the run detail screen.

## Pure-logic harness

`scripts/verify-import.mjs` (repo root) round-trips the polyline codec and runs the
per-km split / elevation derivation against synthetic points, independent of the browser
`DOMParser`. Run with `node scripts/verify-import.mjs`.
