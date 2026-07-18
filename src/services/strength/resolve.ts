import type { EquipmentType, Experience, WorkoutStep } from '@/services/db/types'
import { EXERCISE_BY_ID, STRENGTH_LIBRARY } from './library'
import type { SessionBlock, SessionItem, StrengthExercise, StrengthSessionTemplate } from './types'

const DIFFICULTY_RANK: Record<Experience, number> = { beginner: 0, intermediate: 1, advanced: 2 }

/** Expand user equipment: 'gym' implies band/dumbbells/pull-up bar; 'none' always available. */
export function effectiveEquipment(equipment: EquipmentType[]): Set<EquipmentType> {
  const set = new Set<EquipmentType>(equipment)
  set.add('none')
  if (set.has('gym')) {
    set.add('resistanceBand')
    set.add('dumbbells')
    set.add('pullUpBar')
  }
  return set
}

export function canPerform(ex: StrengthExercise, effective: Set<EquipmentType>): boolean {
  return ex.equipment.some((e) => effective.has(e))
}

/**
 * Resolve one exercise against available equipment. If it's already performable,
 * keep it. Otherwise pick the nearest same-category exercise the user can do,
 * preferring the closest difficulty (progression/regression chain). Every
 * category has a bodyweight option, so a resolution always exists.
 */
export function resolveExercise(exerciseId: string, equipment: EquipmentType[]): string {
  const ex = EXERCISE_BY_ID[exerciseId]
  if (!ex) return exerciseId
  const effective = effectiveEquipment(equipment)
  if (canPerform(ex, effective)) return exerciseId

  const candidates = STRENGTH_LIBRARY.filter(
    (c) => c.category === ex.category && c.id !== ex.id && canPerform(c, effective),
  )
  if (candidates.length === 0) return exerciseId // no fallback (shouldn't happen for seeded data)

  candidates.sort((a, b) => {
    const da = Math.abs(DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[ex.difficulty])
    const db = Math.abs(DIFFICULTY_RANK[b.difficulty] - DIFFICULTY_RANK[ex.difficulty])
    if (da !== db) return da - db
    return a.id.localeCompare(b.id)
  })
  return candidates[0].id
}

/** Select the authored template for a kind + difficulty from a template pool. */
export function pickTemplate(
  templates: StrengthSessionTemplate[],
  kind: StrengthSessionTemplate['kind'],
  difficulty: Experience,
): StrengthSessionTemplate | undefined {
  return (
    templates.find((t) => t.kind === kind && t.difficulty === difficulty) ??
    templates.find((t) => t.kind === kind) // fall back to any difficulty of this kind
  )
}

/**
 * Compress/extend an authored (30-min) block list to the target length.
 * 20 → drop the Finisher block. 45 → +1 set on Main/Core items. 30 → unchanged.
 */
export function resolveDuration(blocks: SessionBlock[], minutes: 20 | 30 | 45): SessionBlock[] {
  if (minutes === 20) {
    return blocks.filter((b) => b.label !== 'Finisher')
  }
  if (minutes === 45) {
    return blocks.map((b) => {
      if (b.label !== 'Main' && b.label !== 'Core') return b
      return {
        ...b,
        items: b.items.map((it) => ({
          ...it,
          sets: (it.sets ?? EXERCISE_BY_ID[it.exerciseId]?.defaultSets ?? 3) + 1,
        })),
      }
    })
  }
  return blocks
}

/** Swap any non-performable exercise in the blocks for an equipment-valid variant. */
export function resolveEquipment(blocks: SessionBlock[], equipment: EquipmentType[]): SessionBlock[] {
  return blocks.map((b) => ({
    ...b,
    items: b.items.map((it) => {
      const id = resolveExercise(it.exerciseId, equipment)
      const superset = it.supersetWith ? resolveExercise(it.supersetWith, equipment) : undefined
      return { ...it, exerciseId: id, supersetWith: superset }
    }),
  }))
}

function itemToStep(item: SessionItem, blockLabel: SessionBlock['label']): WorkoutStep {
  const ex = EXERCISE_BY_ID[item.exerciseId]
  return {
    kind: 'exercise',
    name: ex?.name ?? item.exerciseId,
    sets: item.sets ?? ex?.defaultSets ?? 3,
    reps: item.reps ?? ex?.defaultReps ?? '10',
    exerciseId: item.exerciseId,
    restSeconds: item.restSeconds ?? ex?.restSeconds,
    block: blockLabel,
  }
}

/** Flatten resolved blocks into the WorkoutStep[] stored on a Session. */
export function blocksToSteps(blocks: SessionBlock[]): WorkoutStep[] {
  const steps: WorkoutStep[] = []
  for (const b of blocks) {
    for (const item of b.items) {
      steps.push(itemToStep(item, b.label))
      if (item.supersetWith) {
        steps.push(itemToStep({ ...item, exerciseId: item.supersetWith, supersetWith: undefined }, b.label))
      }
    }
  }
  return steps
}

/** Estimate a session's duration in minutes from resolved blocks (working sets + rest). */
export function estimateDurationMin(blocks: SessionBlock[]): number {
  let seconds = 0
  for (const b of blocks) {
    for (const item of b.items) {
      const ids = [item.exerciseId, ...(item.supersetWith ? [item.supersetWith] : [])]
      for (const id of ids) {
        const ex = EXERCISE_BY_ID[id]
        if (!ex) continue
        const sets = item.sets ?? ex.defaultSets
        const rest = item.restSeconds ?? ex.restSeconds
        seconds += sets * ex.estSecondsPerSet + Math.max(0, sets - 1) * rest
      }
    }
  }
  return Math.round(seconds / 60)
}

export interface ResolvedSession {
  steps: WorkoutStep[]
  durationMin: number
}

/** Full resolve pipeline: difficulty → duration → equipment → steps. */
export function resolveSession(
  templates: StrengthSessionTemplate[],
  kind: StrengthSessionTemplate['kind'],
  difficulty: Experience,
  minutes: 20 | 30 | 45,
  equipment: EquipmentType[],
): (ResolvedSession & { template: StrengthSessionTemplate }) | null {
  const template = pickTemplate(templates, kind, difficulty)
  if (!template) return null
  const durationBlocks = resolveDuration(template.blocks, minutes)
  const resolvedBlocks = resolveEquipment(durationBlocks, equipment)
  return {
    template,
    steps: blocksToSteps(resolvedBlocks),
    durationMin: estimateDurationMin(resolvedBlocks),
  }
}
