import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { LatLng } from '@/services/db/types'
import { haversine } from '@/lib/haversine'

// Lazy-loaded elevation profile: cumulative distance (km) → elevation (m).
// Recharts is introduced here and reused across the Stats charts in Phase 5.

export default function ElevationChart({ track }: { track: LatLng[] }) {
  const data: { km: number; ele: number }[] = []
  let meters = 0
  for (let i = 0; i < track.length; i++) {
    if (i > 0) meters += haversine(track[i - 1], track[i])
    const ele = track[i].ele
    if (typeof ele === 'number') {
      data.push({ km: Math.round((meters / 1000) * 100) / 100, ele: Math.round(ele) })
    }
  }
  if (data.length < 2) return null

  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="eleFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2E8BFF" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#2E8BFF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="km"
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickFormatter={(v) => `${v}`}
            stroke="#1e293b"
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 11 }}
            width={40}
            stroke="#1e293b"
            domain={['dataMin - 5', 'dataMax + 5']}
          />
          <Tooltip
            contentStyle={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12 }}
            labelStyle={{ color: '#94a3b8' }}
            formatter={(value) => [`${value} m`, 'elevation']}
            labelFormatter={(v) => `${v} km`}
          />
          <Area type="monotone" dataKey="ele" stroke="#2E8BFF" strokeWidth={2} fill="url(#eleFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
