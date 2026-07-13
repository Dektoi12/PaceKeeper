import { useEffect } from 'react'
import { MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { LatLng } from '@/services/db/types'

// Lazy-loaded (React.lazy) from RunDetailScreen so Leaflet + its CSS stay out
// of the everyday bundle. Renders a single route polyline fitted to its bounds;
// no markers, so Leaflet's default-icon asset issue never arises.

function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression }) {
  const map = useMap()
  useEffect(() => {
    map.fitBounds(bounds, { padding: [24, 24] })
  }, [map, bounds])
  return null
}

export default function RouteMap({ track }: { track: LatLng[] }) {
  const latlngs = track.map((p) => [p.lat, p.lng] as [number, number])
  if (latlngs.length < 2) return null
  const bounds = L.latLngBounds(latlngs)

  return (
    <div className="h-56 w-full overflow-hidden rounded-card">
      <MapContainer
        bounds={bounds}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%', background: '#0B0E11' }}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Polyline positions={latlngs} pathOptions={{ color: '#2E8BFF', weight: 4 }} />
        <FitBounds bounds={bounds} />
      </MapContainer>
    </div>
  )
}
