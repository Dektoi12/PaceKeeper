import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Run, Session, Units } from '@/services/db/types'
import { formatPace } from '@/lib/formatters'
import {
  consistencyHeatmap,
  easyPaceTrend,
  monthlyTotals,
  weeklyMileage,
} from '@/services/stats'
import { Card } from '@/components/ui'

// Lazy-loaded from StatsScreen so Recharts loads only when the athlete opens
// Stats. All series are derived by the pure functions in services/stats/trends.

const AXIS = { fill: '#64748b', fontSize: 11 }
const GRID = '#1e293b'
const TOOLTIP = {
  contentStyle: { background: '#111827', border: '1px solid #1e293b', borderRadius: 12 },
  labelStyle: { color: '#94a3b8' },
} as const

export default function StatsCharts({
  runs,
  sessions,
  units,
  easyRunIds,
}: {
  runs: Run[]
  sessions: Session[]
  units: Units
  easyRunIds: Set<string>
}) {
  const weekly = weeklyMileage(runs, sessions, 12)
  const monthly = monthlyTotals(runs)
  const pace = easyPaceTrend(runs, easyRunIds)
  const heat = consistencyHeatmap(runs, 119)

  const hasWeekly = weekly.some((w) => w.actualKm > 0 || w.plannedKm > 0)

  return (
    <div className="flex flex-col gap-4">
      {hasWeekly && (
        <Card>
          <p className="text-sm text-slate-400 font-semibold mb-3">Weekly mileage — planned vs actual</p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tick={AXIS} stroke={GRID} interval="preserveStartEnd" />
                <YAxis tick={AXIS} stroke={GRID} width={36} />
                <Tooltip {...TOOLTIP} formatter={(value, name) => [`${Number(value)} ${units}`, name === 'actualKm' ? 'actual' : 'planned']} />
                <Bar dataKey="plannedKm" fill="#334155" radius={[3, 3, 0, 0]} />
                <Bar dataKey="actualKm" fill="#2E8BFF" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {monthly.length > 0 && (
        <Card>
          <p className="text-sm text-slate-400 font-semibold mb-3">Monthly distance</p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tick={AXIS} stroke={GRID} />
                <YAxis tick={AXIS} stroke={GRID} width={36} />
                <Tooltip {...TOOLTIP} formatter={(value) => [`${Number(value)} ${units}`, 'distance']} />
                <Bar dataKey="km" fill="#2E8BFF" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {pace.length >= 2 && (
        <Card>
          <p className="text-sm text-slate-400 font-semibold mb-3">Easy-pace trend</p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pace} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="date" tick={AXIS} stroke={GRID} tickFormatter={(d) => String(d).slice(5)} />
                <YAxis
                  tick={AXIS}
                  stroke={GRID}
                  width={52}
                  reversed
                  domain={['dataMin - 15', 'dataMax + 15']}
                  tickFormatter={(v: number) => formatPace(v, units).split(' ')[0]}
                />
                <Tooltip
                  {...TOOLTIP}
                  formatter={(value) => [formatPace(Number(value), units), 'pace']}
                  labelFormatter={(d) => String(d)}
                />
                <Line type="monotone" dataKey="paceSecPerKm" stroke="#2E8BFF" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card>
        <p className="text-sm text-slate-400 font-semibold mb-3">Consistency — last 17 weeks</p>
        <Heatmap cells={heat} units={units} />
      </Card>
    </div>
  )
}

function Heatmap({
  cells,
  units,
}: {
  cells: { date: string; count: number; km: number }[]
  units: Units
}) {
  const max = Math.max(1, ...cells.map((c) => c.km))
  const color = (km: number) => {
    if (km <= 0) return '#1e293b'
    const t = Math.min(1, km / max)
    // interpolate ink → accent blue by opacity steps
    if (t < 0.25) return '#1d3a5f'
    if (t < 0.5) return '#245c9e'
    if (t < 0.75) return '#2E8BFF'
    return '#5aa6ff'
  }
  // Column-major weeks (7 rows Mon→Sun).
  const weeks: (typeof cells)[] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  return (
    <div className="flex gap-1 overflow-x-auto no-scrollbar">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-1">
          {week.map((c) => (
            <div
              key={c.date}
              title={`${c.date}: ${c.km} ${units}`}
              className="h-3.5 w-3.5 rounded-sm"
              style={{ background: color(c.km) }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
