import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, completeRoutine } from '@/services/db'
import { getExercise } from '@/services/strength'
import { getRunRoutine, isRoutinePhase, type RoutineItem } from '@/services/routines'
import { ExerciseDemo } from '@/components/demo/ExerciseDemo'
import { useCountdown } from '@/hooks/useCountdown'
import { useToast } from '@/components/Toast'

/** One screen of the player. Per-side items contribute two stages. */
interface Stage {
  item: RoutineItem
  sideLabel?: string
}

function buildStages(items: RoutineItem[]): Stage[] {
  return items.flatMap((item) =>
    item.perSide
      ? [
          { item, sideLabel: 'First side' },
          { item, sideLabel: 'Second side' },
        ]
      : [{ item }],
  )
}

export function RoutinePlayerScreen() {
  const { id, phase } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const session = useLiveQuery(() => (id ? db.sessions.get(id) : undefined), [id])
  const routinePhase = isRoutinePhase(phase) ? phase : undefined
  const valid = routinePhase !== undefined
  const routine = routinePhase ? getRunRoutine(routinePhase) : undefined
  const stages = useMemo(() => (routine ? buildStages(routine.items) : []), [routine])

  const [current, setCurrent] = useState(0)
  const [finished, setFinished] = useState(false)

  const advance = () => {
    if (current + 1 >= stages.length) setFinished(true)
    else setCurrent(current + 1)
  }

  const timer = useCountdown(advance)

  // Timed stages run themselves; rep stages wait for a tap.
  useEffect(() => {
    if (finished || stages.length === 0) return
    const seconds = stages[current]?.item.seconds
    if (seconds) timer.start(seconds)
    else timer.stop()
    // timer is recreated each render; re-running on stage change is what we want
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, finished, stages.length])

  useEffect(() => {
    if (!finished || !id || !routinePhase) return
    void completeRoutine(id, routinePhase)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished])

  // Guard invalid phases in an effect so navigation happens after mount.
  useEffect(() => {
    if (!valid) navigate(id ? `/session/${id}` : '/plan', { replace: true })
  }, [valid, id, navigate])

  if (!valid || !routine) return null
  if (session === undefined) return <div className="p-6 text-slate-500">Loading…</div>
  if (session === null) return <div className="p-6 text-slate-500">Session not found.</div>

  const back = () => navigate(`/session/${id}`)

  if (finished) {
    return (
      <div className="min-h-full max-w-md mx-auto flex flex-col px-5 pt-6 pb-6 safe-top">
        <div className="flex-1 flex flex-col items-center text-center justify-center gap-3">
          <div className="text-6xl mb-2">{routinePhase === 'warmup' ? '🔥' : '🧘'}</div>
          <h1 className="text-3xl font-display font-bold">
            {routinePhase === 'warmup' ? 'Good to go' : 'Nicely done'}
          </h1>
          <p className="text-slate-400 text-sm max-w-xs">
            {routinePhase === 'warmup'
              ? 'Warm-up complete — head out and enjoy the run.'
              : 'Cool-down complete. Hydrate and refuel.'}
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            toast.show(routinePhase === 'warmup' ? 'Warm-up done' : 'Cool-down done', 'success')
            back()
          }}
        >
          Back to session
        </button>
      </div>
    )
  }

  const stage = stages[current]
  const exercise = getExercise(stage.item.exerciseId)
  const cue = exercise?.instructionSteps[0]

  return (
    <div className="min-h-full max-w-md mx-auto flex flex-col px-5 pt-6 pb-6 safe-top">
      <div className="flex items-center justify-between mb-4">
        <button className="text-slate-400 text-sm" onClick={back}>
          ✕ Close
        </button>
        <span className="text-sm text-slate-400">
          {current + 1} / {stages.length}
        </span>
      </div>

      <div className="flex gap-1 mb-2">
        {stages.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full flex-1 ${
              i < current ? 'bg-accent-500' : i === current ? 'bg-accent-500/40' : 'bg-ink-600'
            }`}
          />
        ))}
      </div>
      <p className="text-xs uppercase tracking-wide text-slate-500 mb-4">{routine.title}</p>

      <div className="flex-1 flex flex-col items-center text-center justify-center">
        <ExerciseDemo exerciseId={stage.item.exerciseId} size={180} className="mb-4" />

        <h1 className="text-3xl font-display font-bold mb-2">
          {exercise?.name ?? stage.item.exerciseId}
        </h1>

        {stage.sideLabel && (
          <p className="text-sm text-accent-400 mb-1">{stage.sideLabel}</p>
        )}

        {stage.item.seconds ? (
          <p className="stat-number text-5xl tabular-nums my-3">{timer.remaining}s</p>
        ) : (
          <p className="text-slate-300 text-lg mb-3">{stage.item.reps}</p>
        )}

        {cue && <p className="text-sm text-slate-500 max-w-xs">{cue}</p>}
      </div>

      <div className="flex flex-col gap-2">
        {stage.item.seconds ? (
          <button className="btn-ghost" onClick={advance}>
            Skip ahead
          </button>
        ) : (
          <button className="btn-primary" onClick={advance}>
            Done — next
          </button>
        )}
        {current > 0 && (
          <button className="text-slate-500 text-sm" onClick={() => setCurrent(current - 1)}>
            ← Previous
          </button>
        )}
      </div>
    </div>
  )
}
