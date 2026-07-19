import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, startStrengthSession, setStrengthProgress, completeStrengthSession } from '@/services/db'
import { getExercise } from '@/services/strength'
import { SESSION_META } from '@/services/planEngine'
import type { WorkoutStep } from '@/services/db/types'
import { useToast } from '@/components/Toast'
import { ExerciseDemo } from '@/components/demo/ExerciseDemo'
import { useCountdown } from '@/hooks/useCountdown'

type ExerciseStep = Extract<WorkoutStep, { kind: 'exercise' }>

export function StrengthPlayerScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const session = useLiveQuery(() => (id ? db.sessions.get(id) : undefined), [id])
  const exercises = useMemo(
    () => ((session?.steps ?? []).filter((s) => s.kind === 'exercise') as ExerciseStep[]),
    [session?.id],
  )

  const [current, setCurrent] = useState(0)
  const [setsDone, setSetsDone] = useState(0)
  const [completed, setCompleted] = useState<Set<number>>(new Set())
  const [finishing, setFinishing] = useState(false)
  const [effort, setEffort] = useState<1 | 2 | 3 | 4 | 5 | null>(null)
  const [notes, setNotes] = useState('')
  const rest = useCountdown()
  const initRef = useRef(false)

  // On first load: mark inProgress, restore completed set, jump to first undone.
  useEffect(() => {
    if (initRef.current || !session || exercises.length === 0) return
    initRef.current = true
    const done = new Set((session.strengthLog?.completedExerciseIds ?? []).map(Number).filter((n) => !Number.isNaN(n)))
    setCompleted(done)
    let first = 0
    while (first < exercises.length && done.has(first)) first++
    setCurrent(Math.min(first, exercises.length - 1))
    if (session.status !== 'completed') void startStrengthSession(session.id)
  }, [session?.id, exercises.length])

  if (session === undefined) return <div className="p-6 text-slate-500">Loading…</div>
  if (session === null) return <div className="p-6 text-slate-500">Session not found.</div>
  if (exercises.length === 0) {
    return (
      <div className="p-6 text-slate-400">
        This session has no exercises.
        <button className="btn-ghost mt-4" onClick={() => navigate(-1)}>Back</button>
      </div>
    )
  }

  const meta = SESSION_META[session.type]
  const ex = exercises[current]
  const lib = ex.exerciseId ? getExercise(ex.exerciseId) : undefined
  const totalSets = ex.sets
  const allDone = completed.size >= exercises.length

  function persist(next: Set<number>) {
    void setStrengthProgress(session!.id, [...next].map(String))
  }

  function completeSet() {
    const nextCount = setsDone + 1
    if (nextCount >= totalSets) {
      // Exercise finished.
      const next = new Set(completed).add(current)
      setCompleted(next)
      persist(next)
      setSetsDone(0)
      rest.stop()
      goNextUndone(next)
    } else {
      setSetsDone(nextCount)
      if (ex.restSeconds) rest.start(ex.restSeconds)
    }
  }

  function goNextUndone(doneSet: Set<number>) {
    if (doneSet.size >= exercises.length) {
      setFinishing(true)
      return
    }
    let n = current + 1
    while (n < exercises.length && doneSet.has(n)) n++
    if (n >= exercises.length) {
      // Wrap to any earlier undone one.
      n = exercises.findIndex((_, i) => !doneSet.has(i))
    }
    setCurrent(n < 0 ? current : n)
  }

  function move(delta: number) {
    rest.stop()
    setSetsDone(0)
    setCurrent((c) => Math.max(0, Math.min(exercises.length - 1, c + delta)))
  }

  async function finish() {
    await completeStrengthSession(session!.id, {
      perceivedEffort: effort ?? undefined,
      userNotes: notes.trim() || undefined,
      completedExerciseIds: [...completed].map(String),
    })
    toast.show('Session complete 💪', 'success')
    navigate(`/session/${session!.id}`, { replace: true })
  }

  // ---- Completion screen ----
  if (finishing) {
    return (
      <div className="min-h-full max-w-md mx-auto flex flex-col px-5 pt-8 pb-6 safe-top">
        <h1 className="text-2xl font-display font-bold mb-1">Nice work!</h1>
        <p className="text-slate-400 mb-6">{session.title} — how did it feel?</p>

        <p className="text-sm text-slate-400 mb-2">Perceived effort</p>
        <div className="grid grid-cols-5 gap-2 mb-6">
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <button
              key={n}
              onClick={() => setEffort(n)}
              className={`py-4 rounded-xl border text-lg font-semibold transition-colors ${
                effort === n ? 'border-accent-500 bg-accent-500/10 text-accent-300' : 'border-ink-600 text-slate-400'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-600 -mt-4 mb-5">1 = very easy · 5 = maximal</p>

        <label className="flex flex-col gap-1.5 mb-6">
          <span className="text-sm text-slate-400">Notes (optional)</span>
          <textarea
            className="input min-h-[80px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How the session went…"
          />
        </label>

        <div className="mt-auto flex flex-col gap-2">
          <button className="btn-primary" onClick={finish}>Finish session</button>
          <button className="btn-ghost" onClick={() => setFinishing(false)}>Back to exercises</button>
        </div>
      </div>
    )
  }

  // ---- Player screen ----
  return (
    <div className="min-h-full max-w-md mx-auto flex flex-col px-5 pt-6 pb-6 safe-top">
      <div className="flex items-center justify-between mb-4">
        <button className="text-slate-400 text-sm" onClick={() => navigate(`/session/${session.id}`)}>
          ✕ Close
        </button>
        <span className="text-sm text-slate-400">
          {current + 1} / {exercises.length}
        </span>
      </div>

      {/* progress bar */}
      <div className="flex gap-1 mb-6">
        {exercises.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full flex-1 ${
              completed.has(i) ? 'bg-accent-500' : i === current ? 'bg-accent-500/40' : 'bg-ink-600'
            }`}
          />
        ))}
      </div>

      <div className="flex-1 flex flex-col items-center text-center justify-center">
        {ex.block && <span className="text-xs uppercase tracking-wide text-slate-500 mb-2">{ex.block}</span>}
        {ex.exerciseId ? (
          <ExerciseDemo exerciseId={ex.exerciseId} size={170} className="mb-4" />
        ) : (
          <div className="text-6xl mb-4">{meta.icon}</div>
        )}
        <h1 className="text-3xl font-display font-bold mb-2">{ex.name}</h1>
        <p className="text-slate-300 text-lg mb-1">
          {totalSets} × {ex.reps}
        </p>
        {lib?.primaryMuscles?.length ? (
          <p className="text-xs text-slate-500 mb-4 capitalize">{lib.primaryMuscles.join(' · ')}</p>
        ) : (
          <div className="mb-4" />
        )}

        {/* set dots */}
        <div className="flex gap-2 mb-6">
          {Array.from({ length: totalSets }).map((_, i) => (
            <span
              key={i}
              className={`w-4 h-4 rounded-full border ${
                i < setsDone ? 'bg-accent-500 border-accent-500' : 'border-ink-500'
              }`}
            />
          ))}
        </div>

        {rest.active ? (
          <div className="flex flex-col items-center gap-3 w-full">
            <p className="text-sm text-slate-400">Rest</p>
            <p className="stat-number text-5xl text-accent-400 tabular-nums">{rest.remaining}s</p>
            <button className="btn-ghost" onClick={rest.stop}>Skip rest</button>
          </div>
        ) : (
          <button className="btn-primary w-full text-lg py-4" onClick={completeSet}>
            {setsDone + 1 >= totalSets ? 'Complete exercise' : `Complete set ${setsDone + 1}`}
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 pt-4">
        <button className="btn-ghost" onClick={() => move(-1)} disabled={current === 0}>
          ‹ Prev
        </button>
        <button className="text-slate-400 text-sm" onClick={() => setFinishing(true)}>
          {allDone ? 'Finish →' : 'Finish early'}
        </button>
        <button className="btn-ghost" onClick={() => move(1)} disabled={current === exercises.length - 1}>
          Skip ›
        </button>
      </div>
    </div>
  )
}
