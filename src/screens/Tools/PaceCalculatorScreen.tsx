import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUnits } from '@/app/hooks'
import {
  formatPace,
  formatDuration,
  formatDistance,
  kmToUnit,
  unitToKm,
  unitLabel,
  KM_PER_MI,
} from '@/lib/formatters'
import { ScreenHeader, Card } from '@/components/ui'
import { DurationPicker } from '@/components/DurationPicker'

type Target = 'pace' | 'time' | 'distance'

const PRESETS: { label: string; km: number }[] = [
  { label: '1K', km: 1 },
  { label: '5K', km: 5 },
  { label: '10K', km: 10 },
  { label: 'Half', km: 21.0975 },
  { label: 'Marathon', km: 42.195 },
]

/** Classic runner's triangle: pace × distance = time. Solve for whichever
 *  one you pick from the other two. All state is kept in metric internally
 *  and converted for display in the user's units. */
export function PaceCalculatorScreen() {
  const navigate = useNavigate()
  const units = useUnits()
  const unit = unitLabel(units)

  const [target, setTarget] = useState<Target>('pace')
  // Seeded so they're internally consistent: 5 km @ 6:00/km = 30:00.
  const [distanceKm, setDistanceKm] = useState(5)
  const [paceSecPerKm, setPaceSecPerKm] = useState(360)
  const [timeSec, setTimeSec] = useState(1800)

  // Pace is edited/displayed per the user's unit; store per-km.
  const paceSecPerUnit = units === 'mi' ? paceSecPerKm * KM_PER_MI : paceSecPerKm
  const setPaceFromUnit = (secPerUnit: number) =>
    setPaceSecPerKm(units === 'mi' ? secPerUnit / KM_PER_MI : secPerUnit)

  const distanceInUnit = kmToUnit(distanceKm, units)

  // Result for the current target, guarding against divide-by-zero.
  let result = '—'
  if (target === 'pace') {
    result = distanceKm > 0 ? formatPace(timeSec / distanceKm, units) : '—'
  } else if (target === 'time') {
    result = distanceKm > 0 && paceSecPerKm > 0 ? formatDuration(paceSecPerKm * distanceKm) : '—'
  } else {
    result = paceSecPerKm > 0 ? formatDistance(timeSec / paceSecPerKm, units) : '—'
  }

  return (
    <div>
      <ScreenHeader
        title="Pace calculator"
        right={
          <button onClick={() => navigate(-1)} className="text-slate-400 text-sm">
            Done
          </button>
        }
      />

      <div className="px-4 flex flex-col gap-4">
        <div className="grid grid-flow-col auto-cols-fr gap-1 bg-ink-700 p-1 rounded-xl">
          {(['pace', 'time', 'distance'] as Target[]).map((t) => (
            <button
              key={t}
              onClick={() => setTarget(t)}
              className={`py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                target === t ? 'bg-accent-500 text-white' : 'text-slate-400'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 -mt-2">
          Enter the other two and we'll work out the {target}.
        </p>

        {/* Distance — hidden when it's the thing we're solving for. */}
        {target !== 'distance' && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-slate-400">Distance ({unit})</span>
            <input
              className="input"
              inputMode="decimal"
              value={round2(distanceInUnit)}
              onChange={(e) => setDistanceKm(unitToKm(Number(e.target.value) || 0, units))}
            />
            <div className="flex flex-wrap gap-1.5 mt-1">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setDistanceKm(p.km)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    approxEqual(distanceKm, p.km)
                      ? 'bg-accent-500 border-accent-500 text-white'
                      : 'bg-ink-700 border-ink-600 text-slate-400'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pace — hidden when it's the thing we're solving for. */}
        {target !== 'pace' && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-slate-400">Pace (min/{unit})</span>
            <DurationPicker
              seconds={Math.round(paceSecPerUnit)}
              onChange={setPaceFromUnit}
              showHours={false}
            />
          </div>
        )}

        {/* Time — hidden when it's the thing we're solving for. */}
        {target !== 'time' && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-slate-400">Time</span>
            <DurationPicker seconds={timeSec} onChange={setTimeSec} />
          </div>
        )}

        <Card className="flex items-center justify-between mt-1">
          <span className="text-sm text-slate-400 capitalize">{target}</span>
          <span className="stat-number text-2xl text-accent-400">{result}</span>
        </Card>
      </div>
    </div>
  )
}

const round2 = (n: number) => Math.round(n * 100) / 100
const approxEqual = (a: number, b: number) => Math.abs(a - b) < 0.01
