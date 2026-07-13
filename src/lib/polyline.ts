import type { LatLng } from '@/services/db/types'

// Google Encoded Polyline codec, extended with an optional third interleaved
// value for elevation. lat/lng use precision 1e5 (~1 m); elevation uses 1e2
// (cm). Runs store the encoded string in `Run.track` to keep IndexedDB compact
// — a 10 km GPS track shrinks from tens of KB of JSON to a short ASCII string.
//
// The classic algorithm (deltas → zig-zag → 5-bit chunks offset by 63) is kept
// intact; elevation is simply a third channel appended per point. A point is
// encoded with elevation iff its `ele` is a finite number.

const LATLNG_FACTOR = 1e5
const ELE_FACTOR = 1e2

function encodeSignedNumber(value: number, out: string[]): void {
  let num = value < 0 ? ~(value << 1) : value << 1
  while (num >= 0x20) {
    out.push(String.fromCharCode((0x20 | (num & 0x1f)) + 63))
    num >>= 5
  }
  out.push(String.fromCharCode(num + 63))
}

/** Encode a track to a polyline string. Elevation is included per-point. */
export function encode(track: LatLng[]): string {
  const out: string[] = []
  let prevLat = 0
  let prevLng = 0
  let prevEle = 0
  for (const p of track) {
    const lat = Math.round(p.lat * LATLNG_FACTOR)
    const lng = Math.round(p.lng * LATLNG_FACTOR)
    encodeSignedNumber(lat - prevLat, out)
    encodeSignedNumber(lng - prevLng, out)
    const ele = Math.round((p.ele ?? 0) * ELE_FACTOR)
    encodeSignedNumber(ele - prevEle, out)
    prevLat = lat
    prevLng = lng
    prevEle = ele
  }
  return out.join('')
}

/** Decode a polyline string back to a track (lat/lng/ele triples). */
export function decode(str: string): LatLng[] {
  const track: LatLng[] = []
  let index = 0
  let lat = 0
  let lng = 0
  let ele = 0

  const next = (): number => {
    let result = 0
    let shift = 0
    let byte: number
    do {
      byte = str.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    return result & 1 ? ~(result >> 1) : result >> 1
  }

  while (index < str.length) {
    lat += next()
    lng += next()
    ele += next()
    track.push({
      lat: lat / LATLNG_FACTOR,
      lng: lng / LATLNG_FACTOR,
      ele: ele / ELE_FACTOR,
    })
  }
  return track
}
