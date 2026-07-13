import type { LatLng, Split } from '@/services/db/types'
import { haversine } from '@/lib/haversine'
import type { LapSummary, RunImport, TrackPoint } from './types'

const ELE_NOISE_THRESHOLD_M = 3 // ignore climbs smaller than this (GPS jitter)

function isGeo(p: TrackPoint): p is TrackPoint & { lat: number; lng: number } {
  return typeof p.lat === 'number' && typeof p.lng === 'number'
}

/** Local yyyy-MM-dd for an epoch-ms timestamp. */
function localDate(ms: number): string {
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Smoothed cumulative elevation gain: sum positive deltas of a moving-average
 * elevation series, ignoring sub-threshold wiggle. Returns undefined when no
 * point carries elevation.
 */
function elevationGain(points: TrackPoint[]): number | undefined {
  const eles = points.map((p) => p.ele).filter((e): e is number => typeof e === 'number')
  if (eles.length < 2) return undefined
  // 5-point moving average to reject spikes.
  const smoothed: number[] = []
  const win = 2
  for (let i = 0; i < eles.length; i++) {
    let sum = 0
    let n = 0
    for (let j = Math.max(0, i - win); j <= Math.min(eles.length - 1, i + win); j++) {
      sum += eles[j]
      n++
    }
    smoothed.push(sum / n)
  }
  let gain = 0
  let ref = smoothed[0]
  for (let i = 1; i < smoothed.length; i++) {
    const delta = smoothed[i] - ref
    if (delta >= ELE_NOISE_THRESHOLD_M) {
      gain += delta
      ref = smoothed[i]
    } else if (smoothed[i] < ref) {
      ref = smoothed[i]
    }
  }
  return Math.round(gain)
}

/** Per-km splits derived by accumulating haversine distance across geo points. */
function deriveSplits(points: (TrackPoint & { lat: number; lng: number })[]): Split[] {
  if (points.length < 2) return []
  const splits: Split[] = []
  let segMeters = 0
  let segStartTime = points[0].time
  let hrSum = 0
  let hrCount = 0
  let index = 1

  const pushSplit = (endTime: number | undefined, meters: number) => {
    const durationSec =
      segStartTime != null && endTime != null ? (endTime - segStartTime) / 1000 : 0
    const distanceKm = meters / 1000
    splits.push({
      index,
      distanceKm: Math.round(distanceKm * 1000) / 1000,
      durationSec: Math.round(durationSec),
      paceSecPerKm: distanceKm > 0 ? Math.round(durationSec / distanceKm) : 0,
      avgHR: hrCount ? Math.round(hrSum / hrCount) : undefined,
    })
    index++
  }

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const cur = points[i]
    let d = haversine(prev, cur)
    if (typeof cur.hr === 'number') {
      hrSum += cur.hr
      hrCount++
    }
    // Cross one or more km boundaries within this segment.
    while (segMeters + d >= 1000) {
      const need = 1000 - segMeters
      const frac = d > 0 ? need / d : 0
      const boundaryTime =
        prev.time != null && cur.time != null
          ? prev.time + (cur.time - prev.time) * frac
          : cur.time
      pushSplit(boundaryTime, 1000)
      d -= need
      segMeters = 0
      segStartTime = boundaryTime
      hrSum = typeof cur.hr === 'number' ? cur.hr : 0
      hrCount = typeof cur.hr === 'number' ? 1 : 0
    }
    segMeters += d
  }
  // Trailing partial km.
  if (segMeters > 50) {
    pushSplit(points[points.length - 1].time, segMeters)
  }
  return splits
}

/**
 * Build a RunImport from decoded points (+ optional file-provided laps).
 * Geometry drives distance/splits; laps only supply HR fallbacks and totals
 * when there is no usable track.
 */
export function buildRunImport(
  source: RunImport['source'],
  rawFileName: string,
  points: TrackPoint[],
  laps: LapSummary[] = [],
): RunImport {
  const geo = points.filter(isGeo)
  const times = points.map((p) => p.time).filter((t): t is number => typeof t === 'number')
  const startTime = times.length ? Math.min(...times) : undefined
  const endTime = times.length ? Math.max(...times) : undefined

  const hrs = points.map((p) => p.hr).filter((h): h is number => typeof h === 'number')
  let avgHR = hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : undefined
  let maxHR = hrs.length ? Math.max(...hrs) : undefined

  let distanceKm = 0
  let splits: Split[] = []
  let track: LatLng[] = []
  let totalsOnly = false

  if (geo.length >= 2) {
    for (let i = 1; i < geo.length; i++) distanceKm += haversine(geo[i - 1], geo[i]) / 1000
    splits = deriveSplits(geo)
    track = geo.map((p) => ({ lat: p.lat, lng: p.lng, ele: p.ele }))
  } else if (laps.length) {
    // No usable geometry — fall back to lap totals.
    totalsOnly = true
    distanceKm = laps.reduce((a, l) => a + l.distanceKm, 0)
    splits = laps.map((l, i) => ({
      index: i + 1,
      distanceKm: Math.round(l.distanceKm * 1000) / 1000,
      durationSec: Math.round(l.durationSec),
      paceSecPerKm: l.distanceKm > 0 ? Math.round(l.durationSec / l.distanceKm) : 0,
      avgHR: l.avgHR,
    }))
    const lapAvg = laps.map((l) => l.avgHR).filter((h): h is number => typeof h === 'number')
    if (!avgHR && lapAvg.length) avgHR = Math.round(lapAvg.reduce((a, b) => a + b, 0) / lapAvg.length)
    const lapMax = laps.map((l) => l.maxHR).filter((h): h is number => typeof h === 'number')
    if (!maxHR && lapMax.length) maxHR = Math.max(...lapMax)
  } else {
    totalsOnly = true
  }

  const durationSec =
    startTime != null && endTime != null && endTime > startTime
      ? Math.round((endTime - startTime) / 1000)
      : laps.reduce((a, l) => a + l.durationSec, 0)

  distanceKm = Math.round(distanceKm * 1000) / 1000
  const avgPaceSecPerKm = distanceKm > 0 ? Math.round(durationSec / distanceKm) : 0

  return {
    source,
    date: startTime != null ? localDate(startTime) : localDate(Date.now()),
    startTime,
    distanceKm,
    durationSec,
    avgPaceSecPerKm,
    splits,
    avgHR,
    maxHR,
    elevationGainM: elevationGain(points),
    track,
    rawFileName,
    totalsOnly,
  }
}
