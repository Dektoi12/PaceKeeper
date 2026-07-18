import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setSessionStatus, moveSession, swapSessions } from '@/services/db'
import { SESSION_META } from '@/services/planEngine'
import type { Session } from '@/services/db/types'
import { weekDates, fromISO, formatLongDate, format } from '@/lib/dates'
import { formatDistance } from '@/lib/formatters'
import { useUnits } from '@/app/hooks'
import { useToast } from '@/components/Toast'
import { Card } from '@/components/ui'
import { SessionTypeBadge } from '@/components/SessionTypeBadge'
import { ZoneChip } from '@/components/ZoneChip'
import { StepTimeline } from '@/components/StepTimeline'
import { BottomSheet } from '@/components/BottomSheet'
import { getExercise } from '@/services/strength'

const RUNNABLE = ['easy', 'tempo', 'intervals', 'hills', 'fartlek', 'long']

export function SessionDetailScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const units = useUnits()
  const toast = useToast()
  const [editing, setEditing] = useState<'none' | 'move' | 'swap'>('none')
  const [openExerciseId, setOpenExerciseId] = useState<string | null>(null)

  const session = useLiveQuery(() => (id ? db.sessions.get(id) : undefined), [id])
  const weekSiblings = useLiveQuery(async () => {
    if (!session) return []
    const days = weekDates(fromISO(session.date))
    const all = await db.sessions.where('date').anyOf(days).toArray()
    return all.filter((s) => s.id !== session.id)
  }, [session?.id, session?.date])

  const linkedRun = useLiveQuery(
    () => (session?.linkedRunId ? db.runs.get(session.linkedRunId) : undefined),
    [session?.linkedRunId],
  )

  if (session === undefined) return <div className="p-6 text-slate-500">Loading…</div>
  if (session === null) return <div className="p-6 text-slate-500">Session not found.</div>

  const meta = SESSION_META[session.type]
  const isRunnable = RUNNABLE.includes(session.type)
  const isChecklist = session.type === 'strength' || session.type === 'mobility'

  const adjacentToLong = (weekSiblings ?? []).some((s) => s.type === 'long')

  async function skip() {
    await setSessionStatus(session!.id, 'skipped')
    toast.show('Session skipped')
  }
  async function markDone() {
    await setSessionStatus(session!.id, 'completed')
    toast.show('Marked complete', 'success')
  }
  async function doMove(newDate: string) {
    await moveSession(session!.id, newDate)
    setEditing('none')
    toast.show(`Moved to ${format(fromISO(newDate), 'EEE d')}`)
  }
  async function doSwap(otherId: string) {
    await swapSessions(session!.id, otherId)
    setEditing('none')
    toast.show('Sessions swapped')
  }

  return (
    <div className="px-4 pt-3">
      <button onClick={() => navigate(-1)} className="text-slate-400 text-sm mb-3">
        ‹ Back
      </button>

      <div className="flex items-center gap-2 mb-2">
        <SessionTypeBadge type={session.type} />
        <span className="text-sm text-slate-400">{formatLongDate(session.date)}</span>
      </div>
      <h1 className="text-2xl font-display font-bold">{session.title}</h1>

      <div className="flex flex-wrap gap-2 mt-3">
        {session.targetZone && <ZoneChip zone={session.targetZone} pace={session.targetPaceRange} units={units} />}
        {session.plannedDistanceKm != null && (
          <span className="text-sm text-slate-300 self-center">{formatDistance(session.plannedDistanceKm, units)}</span>
        )}
        {session.plannedDurationMin != null && (
          <span className="text-sm text-slate-300 self-center">{session.plannedDurationMin} min</span>
        )}
      </div>

      <Card className="mt-4">
        <p className="text-sm text-slate-400 mb-1 font-semibold" style={{ color: meta.color }}>
          Why this session
        </p>
        <p className="text-sm text-slate-300">{meta.why}</p>
      </Card>

      {session.steps.length > 0 && (
        <Card className="mt-4">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-2">
            {isChecklist ? 'Exercises' : 'Workout'}
          </h2>
          <StepTimeline
            steps={session.steps}
            units={units}
            onExerciseTap={isChecklist ? setOpenExerciseId : undefined}
          />
        </Card>
      )}

      {session.status === 'completed' && linkedRun && (
        <Card className="mt-4" onClick={() => navigate(`/run/${linkedRun.id}`)}>
          <p className="text-session-easy text-sm font-semibold">✓ Completed</p>
          <p className="text-sm text-slate-300 mt-1">
            {formatDistance(linkedRun.distanceKm, units)} logged — tap to view run
          </p>
        </Card>
      )}

      {/* Actions */}
      {session.status !== 'completed' && (
        <div className="mt-5 flex flex-col gap-2">
          {isRunnable && (
            <button
              className="btn-primary"
              onClick={() => navigate('/log', { state: { sessionId: session.id } })}
            >
              Log this run
            </button>
          )}
          {isChecklist && (
            <button className="btn-primary" onClick={markDone}>
              Mark complete
            </button>
          )}

          {editing === 'none' && (
            <div className="grid grid-cols-3 gap-2">
              <button className="btn-ghost" onClick={() => setEditing('move')}>
                Move
              </button>
              <button className="btn-ghost" onClick={() => setEditing('swap')} disabled={(weekSiblings ?? []).length === 0}>
                Swap
              </button>
              <button className="btn-ghost" onClick={skip}>
                Skip
              </button>
            </div>
          )}

          {editing === 'move' && (
            <Card>
              {adjacentToLong && ['tempo', 'intervals', 'hills'].includes(session.type) && (
                <p className="text-xs text-session-tempo mb-2">
                  ⚠ Heads up: keep hard sessions a day away from your long run.
                </p>
              )}
              <p className="text-sm text-slate-400 mb-2">Pick a new date this week:</p>
              <div className="grid grid-cols-4 gap-2">
                {weekDates(fromISO(session.date)).map((iso) => (
                  <button
                    key={iso}
                    onClick={() => doMove(iso)}
                    className={`py-2 rounded-lg text-xs border ${
                      iso === session.date ? 'border-accent-500 text-accent-400' : 'border-ink-600 text-slate-300'
                    }`}
                  >
                    {format(fromISO(iso), 'EEE d')}
                  </button>
                ))}
              </div>
              <button className="text-slate-500 text-sm mt-2" onClick={() => setEditing('none')}>
                Cancel
              </button>
            </Card>
          )}

          {editing === 'swap' && (
            <Card>
              <p className="text-sm text-slate-400 mb-2">Swap dates with:</p>
              <div className="flex flex-col gap-2">
                {(weekSiblings ?? []).map((s: Session) => (
                  <button
                    key={s.id}
                    onClick={() => doSwap(s.id)}
                    className="flex items-center justify-between p-2 rounded-lg border border-ink-600 text-left"
                  >
                    <span className="text-sm text-slate-200">{s.title}</span>
                    <span className="text-xs text-slate-500">{format(fromISO(s.date), 'EEE d')}</span>
                  </button>
                ))}
              </div>
              <button className="text-slate-500 text-sm mt-2" onClick={() => setEditing('none')}>
                Cancel
              </button>
            </Card>
          )}
        </div>
      )}

      {session.status === 'skipped' && (
        <button className="btn-ghost w-full mt-4" onClick={() => setSessionStatus(session.id, 'upcoming')}>
          Un-skip
        </button>
      )}

      <ExerciseSheet exerciseId={openExerciseId} onClose={() => setOpenExerciseId(null)} />
    </div>
  )
}

function ExerciseSheet({
  exerciseId,
  onClose,
}: {
  exerciseId: string | null
  onClose: () => void
}) {
  const exercise = exerciseId ? getExercise(exerciseId) : undefined
  return (
    <BottomSheet open={!!exercise} onClose={onClose} title={exercise?.name}>
      {exercise && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <span className="text-xs px-2 py-1 rounded-lg bg-ink-700 text-slate-300 capitalize">
              {exercise.category}
            </span>
            <span className="text-xs px-2 py-1 rounded-lg bg-ink-700 text-slate-300 capitalize">
              {exercise.difficulty}
            </span>
            <span className="text-xs px-2 py-1 rounded-lg bg-ink-700 text-slate-300">
              {exercise.defaultSets} × {exercise.defaultReps}
            </span>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-300 mb-1.5">How to do it</p>
            <ol className="flex flex-col gap-1.5 list-decimal list-inside text-sm text-slate-300">
              {exercise.instructionSteps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>

          {exercise.commonMistakes.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-session-tempo mb-1.5">Common mistakes</p>
              <ul className="flex flex-col gap-1 list-disc list-inside text-sm text-slate-400">
                {exercise.commonMistakes.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  )
}
