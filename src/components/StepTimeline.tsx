import type { WorkoutStep, Units } from '@/services/db/types'
import { formatDistance, formatPaceRange } from '@/lib/formatters'

// Vertical timeline rendering of WorkoutStep[] (spec §6.3.3).

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
    case 'repeat':
      return { title: `Repeat ${step.times}×`, detail: undefined }
  }
}

function StepRow({ step, units, depth = 0 }: { step: WorkoutStep; units: Units; depth?: number }) {
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
            <StepRow key={i} step={s} units={units} depth={depth + 1} />
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="w-2.5 h-2.5 rounded-full bg-slate-500 shrink-0 mt-1.5" />
      <div className="flex-1">
        <div className="text-slate-100 font-medium">{title}</div>
        {detail && <div className="text-sm text-slate-400">{detail}</div>}
      </div>
    </div>
  )
}

export function StepTimeline({ steps, units }: { steps: WorkoutStep[]; units: Units }) {
  if (steps.length === 0) return null
  return (
    <div className="flex flex-col">
      {steps.map((s, i) => (
        <StepRow key={i} step={s} units={units} />
      ))}
    </div>
  )
}
