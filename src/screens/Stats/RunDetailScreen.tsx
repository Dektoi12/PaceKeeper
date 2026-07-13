import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, unlinkRun, deleteRun } from '@/services/db'
import { compareToTarget } from '@/services/stats'
import { formatLongDate } from '@/lib/dates'
import { formatDistance, formatDuration, formatPace } from '@/lib/formatters'
import { useUnits } from '@/app/hooks'
import { useToast } from '@/components/Toast'
import { Card, StatNumber } from '@/components/ui'
import { SessionTypeBadge } from '@/components/SessionTypeBadge'
import { feelEmoji } from '@/components/FeelPicker'

export function RunDetailScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const units = useUnits()
  const toast = useToast()

  const run = useLiveQuery(() => (id ? db.runs.get(id) : undefined), [id])
  const session = useLiveQuery(
    () => (run?.matchedSessionId ? db.sessions.get(run.matchedSessionId) : undefined),
    [run?.matchedSessionId],
  )

  if (run === undefined) return <div className="p-6 text-slate-500">Loading…</div>
  if (run === null) return <div className="p-6 text-slate-500">Run not found.</div>

  const comparison = session ? compareToTarget(run, session) : null

  async function onUnlink() {
    await unlinkRun(run!.id)
    toast.show('Unlinked from session')
  }
  async function onDelete() {
    await deleteRun(run!.id)
    toast.show('Run deleted')
    navigate('/stats', { replace: true })
  }

  return (
    <div className="px-4 pt-3">
      <button onClick={() => navigate(-1)} className="text-slate-400 text-sm mb-3">
        ‹ Back
      </button>

      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm text-slate-400">{formatLongDate(run.date)}</span>
        <span className="text-xs text-slate-600">{run.source === 'manual' ? 'Manual entry' : run.source.toUpperCase()}</span>
      </div>
      <h1 className="text-2xl font-display font-bold">{formatDistance(run.distanceKm, units)}</h1>

      <Card className="mt-4 flex justify-between">
        <StatNumber value={formatDuration(run.durationSec)} label="time" />
        <StatNumber value={formatPace(run.avgPaceSecPerKm, units).split(' ')[0]} label={`pace /${units}`} accent />
        <StatNumber value={feelEmoji(run.feel)} label="feel" />
        {run.effortRPE != null && <StatNumber value={run.effortRPE} label="RPE" />}
      </Card>

      {session && (
        <Card className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <SessionTypeBadge type={session.type} />
              <span className="text-sm text-slate-300">{session.title}</span>
            </div>
            <button className="text-xs text-slate-500" onClick={onUnlink}>
              Unlink
            </button>
          </div>
          {comparison && session.targetPaceRange && (
            <p className="text-sm">
              {comparison.withinTarget ? (
                <span className="text-session-easy">✅ On target — nailed the pace band.</span>
              ) : (
                <span className={comparison.deltaSecPerKm < 0 ? 'text-session-tempo' : 'text-slate-300'}>
                  You ran {formatPace(run.avgPaceSecPerKm, units)} — {comparison.targetLabel} (
                  {Math.abs(Math.round(comparison.deltaSecPerKm))} s/km {comparison.deltaSecPerKm < 0 ? 'faster' : 'slower'}).
                </span>
              )}
            </p>
          )}
        </Card>
      )}

      {run.notes && (
        <Card className="mt-4">
          <p className="text-sm text-slate-400 font-semibold mb-1">Notes</p>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">{run.notes}</p>
        </Card>
      )}

      {run.splits && run.splits.length > 0 && (
        <Card className="mt-4">
          <p className="text-sm text-slate-400 font-semibold mb-2">Splits</p>
          <div className="flex flex-col gap-1">
            {run.splits.map((sp) => (
              <div key={sp.index} className="flex justify-between text-sm">
                <span className="text-slate-500">{sp.index}</span>
                <span className="text-slate-200">{formatPace(sp.paceSecPerKm, units)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!run.matchedSessionId && (
        <p className="text-xs text-slate-600 mt-4 text-center">
          Route maps and elevation appear here for imported GPS files (next build).
        </p>
      )}

      <button className="text-session-intervals text-sm w-full mt-6 py-2" onClick={onDelete}>
        Delete run
      </button>
    </div>
  )
}
