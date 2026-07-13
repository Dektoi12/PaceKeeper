import type { LatLng, RunSource, Split } from '@/services/db/types'

/** A single decoded sample from a GPS file (before per-km aggregation). */
export interface TrackPoint {
  lat?: number
  lng?: number
  ele?: number
  hr?: number
  time?: number // epoch ms
}

/** A lap/split summary read directly from the file (TCX/FIT), if present. */
export interface LapSummary {
  distanceKm: number
  durationSec: number
  avgHR?: number
  maxHR?: number
}

/**
 * Parsed, normalized intermediate produced by every importer. `logRun` consumes
 * a subset of this (the derived totals + encoded track). `track` here is the
 * decoded point list; it is polyline-encoded only at save time.
 */
export interface RunImport {
  source: RunSource
  date: string // yyyy-MM-dd (from the first timestamp, local)
  startTime?: number // epoch ms of the first sample
  distanceKm: number
  durationSec: number
  avgPaceSecPerKm: number
  splits: Split[]
  avgHR?: number
  maxHR?: number
  elevationGainM?: number
  track: LatLng[] // points with lat/lng (ele optional)
  rawFileName: string
  /** True when we could only recover totals (no per-point track/splits). */
  totalsOnly: boolean
}
