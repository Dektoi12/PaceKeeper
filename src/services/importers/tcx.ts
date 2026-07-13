import { buildRunImport } from './preview'
import { childByLocalName, descendantsByLocalName, num } from './dom'
import type { LapSummary, RunImport, TrackPoint } from './types'

// TCX (Garmin Training Center XML) has native <Trackpoint> geometry plus <Lap>
// summaries with distance/time/HR. We prefer geometry for distance & splits and
// keep laps only as a fallback for HR/totals (handled in buildRunImport).

/** Read an HR bpm value from a <HeartRateBpm><Value>… wrapper or direct text. */
function hrOf(parent: Element | undefined): number | undefined {
  if (!parent) return undefined
  const hrEl = childByLocalName(parent, 'HeartRateBpm')
  if (!hrEl) return undefined
  const valueEl = childByLocalName(hrEl, 'Value')
  return num(valueEl?.textContent ?? hrEl.textContent)
}

export function parseTcx(xml: string, rawFileName: string): RunImport {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error('This file is not valid TCX.')
  }

  const points: TrackPoint[] = descendantsByLocalName(doc, 'Trackpoint').map((tp) => {
    const posEl = childByLocalName(tp, 'Position')
    const latEl = posEl && childByLocalName(posEl, 'LatitudeDegrees')
    const lngEl = posEl && childByLocalName(posEl, 'LongitudeDegrees')
    const altEl = childByLocalName(tp, 'AltitudeMeters')
    const timeEl = childByLocalName(tp, 'Time')
    const t = timeEl?.textContent ? Date.parse(timeEl.textContent) : NaN
    return {
      lat: num(latEl?.textContent),
      lng: num(lngEl?.textContent),
      ele: num(altEl?.textContent),
      hr: hrOf(tp),
      time: Number.isFinite(t) ? t : undefined,
    }
  })

  const laps: LapSummary[] = descendantsByLocalName(doc, 'Lap').map((lap) => {
    const distEl = childByLocalName(lap, 'DistanceMeters')
    const timeEl = childByLocalName(lap, 'TotalTimeSeconds')
    const maxEl = childByLocalName(lap, 'MaximumHeartRateBpm')
    const avgEl = childByLocalName(lap, 'AverageHeartRateBpm')
    return {
      distanceKm: (num(distEl?.textContent) ?? 0) / 1000,
      durationSec: num(timeEl?.textContent) ?? 0,
      avgHR: avgEl ? num(childByLocalName(avgEl, 'Value')?.textContent) : undefined,
      maxHR: maxEl ? num(childByLocalName(maxEl, 'Value')?.textContent) : undefined,
    }
  })

  if (!points.length && !laps.length) {
    throw new Error('No trackpoints or laps found in this TCX file.')
  }

  return buildRunImport('tcx', rawFileName, points, laps)
}
