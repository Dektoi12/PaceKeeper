import type { WorkoutStep, Units } from '@/services/db/types'
import { formatDistance, formatPaceRange } from '@/lib/formatters'

// Vertical timeline rendering of WorkoutStep[] (spec §6.3.3). Strength sessions
// add optional block labels and tappable exercise rows (info bottom sheet).

function stepLabel(step: WorkoutStep, units: Units): { title: string; detail?: string } {
  switch (step.kind) {
    case 'warmup':
      return { title: 'Warm-up', detail: `${step.durationMin} min · ${step.zone}` }
    case 'cooldown':
      return { title: 'Cool-down', detail: `${step.durationMin} min · ${step.zone}` }
    case 'run': {
      const bits: string[] = []
      if (step.distanceKm) bits.push(formatDistance(step.distanceKm, units))
      if (step.durationMin) bits.push(`${step.durationMin} min`)
      if (step.targetPace) bits.push(formatPaceRange(step.targetPace, units))
      bits.push(step.zone)
      return { title: step.label ?? 'Run', detail: bits.join(' · ') }
    }
    case 'recover':
      return { title: 'Recover', detail: `${step.durationMin} min ${step.mode}` }
    case 'exercise': {
      const bits = [`${step.sets} × ${step.reps}`]
      if (step.restSeconds) bits.push(`${step.restSeconds}s rest`)
      return { title: step.name, detail: bits.join(' · ') }
    }
    case 'repeat':
      return { title: `Repeat ${step.times}×`, detail: undefined }
  }
}

function StepRow({
  step,
  units,
  depth = 0,
  onExerciseTap,
}: {
  step: WorkoutStep
  units: Units
  depth?: number
  onExerciseTap?: (exerciseId: string) => void
}) {
  const { title, detail } = stepLabel(step, units)
  if (step.kind === 'repeat') {
    return (
      <div className="relative">
        <div className="flex items-center gap-3 py-2">
          <span className="w-2.5 h-2.5 rounded-full bg-accent-500 shrink-0" />
          <span className="font-semibold text-accent-400">{title}</span>
        </div>
        <div className="ml-1.5 border-l-2 border-accent-500/30 pl-4">
          {step.steps.map((s, i) => (
            <StepRow key={i} step={s} units={units} depth={depth + 1} onExerciseTap={onExerciseTap} />
          ))}
        </div>
      </div>
    )
  }

  const tappable = step.kind === 'exercise' && step.exerciseId && onExerciseTap
  const inner = (
    <div className="flex items-start gap-3 py-2">
      <span className="w-2.5 h-2.5 rounded-full bg-slate-500 shrink-0 mt-1.5" />
      <div className="flex-1">
        <div className="text-slate-100 font-medium">{title}</div>
        {detail && <div className="text-sm text-slate-400">{detail}</div>}
      </div>
      {tappable && <span className="text-slate-500 text-sm self-center">ⓘ</span>}
    </div>
  )

  if (tappable) {
    return (
      <button className="w-full text-left" onClick={() => onExerciseTap!(step.exerciseId!)}>
        {inner}
      </button>
    )
  }
  return inner
}

export function StepTimeline({
  steps,
  units,
  onExerciseTap,
}: {
  steps: WorkoutStep[]
  units: Units
  onExerciseTap?: (exerciseId: string) => void
}) {
  if (steps.length === 0) return null

  let currentBlock: string | undefined
  return (
    <div className="flex flex-col">
      {steps.map((s, i) => {
        const block = s.kind === 'exercise' ? s.block : undefined
        const showHeader = block && block !== currentBlock
        if (block) currentBlock = block
        return (
          <div key={i}>
            {showHeader && (
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mt-3 mb-0.5">
                {block}
              </div>
            )}
            <StepRow step={s} units={units} onExerciseTap={onExerciseTap} />
          </div>
        )
      })}
    </div>
  )
}
