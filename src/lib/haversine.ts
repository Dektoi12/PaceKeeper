import type { LatLng } from '@/services/db/types'

const R = 6371000 // earth radius, meters

/** Great-circle distance in meters between two coords. */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Sum of segment distances (km) along a track. Used by future GPS import. */
export function trackDistanceKm(track: LatLng[]): number {
  let meters = 0
  for (let i = 1; i < track.length; i++) meters += haversine(track[i - 1], track[i])
  return meters / 1000
}
