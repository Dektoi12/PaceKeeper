import { buildRunImport } from './preview'
import { descendantsByLocalName, firstDescendantByLocalName, num } from './dom'
import type { RunImport, TrackPoint } from './types'

// GPX 1.1 is namespaced XML. We match on local element names (see ./dom) so the
// gpxtpx/ns3 HR extensions used by Zepp/Strava/Garmin all parse the same way.

export function parseGpx(xml: string, rawFileName: string): RunImport {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error('This file is not valid GPX.')
  }

  const trkpts = descendantsByLocalName(doc, 'trkpt')
  if (!trkpts.length) throw new Error('No track points found in this GPX file.')

  const points: TrackPoint[] = trkpts.map((pt) => {
    const eleEl = firstDescendantByLocalName(pt, 'ele')
    const timeEl = firstDescendantByLocalName(pt, 'time')
    const hrEl = firstDescendantByLocalName(pt, 'hr')
    const timeText = timeEl?.textContent ?? undefined
    const t = timeText ? Date.parse(timeText) : NaN
    return {
      lat: num(pt.getAttribute('lat')),
      lng: num(pt.getAttribute('lon')),
      ele: num(eleEl?.textContent),
      hr: num(hrEl?.textContent),
      time: Number.isFinite(t) ? t : undefined,
    }
  })

  return buildRunImport('gpx', rawFileName, points)
}
