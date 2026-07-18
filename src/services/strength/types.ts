import type {
  EquipmentType,
  Experience,
  RunInterference,
  StrengthBlockLabel,
  StrengthGoal,
  StrengthSessionKind,
} from '@/services/db/types'

export type ExerciseCategory = 'legs' | 'core' | 'push' | 'pull' | 'fullBody' | 'mobility'

export interface StrengthExercise {
  id: string // slug, e.g. 'bw-squat'
  name: string
  category: ExerciseCategory
  primaryMuscles: string[]
  equipment: EquipmentType[] // which equipment can perform it; 'none' = bodyweight
  difficulty: Experience
  progressionOf?: string // id of the EASIER variant this progresses from
  regressionOf?: string // id of the HARDER variant this regresses from
  instructionSteps: string[] // 3–5 short cues, ≤12 words each
  commonMistakes: string[] // 1–3 items
  defaultSets: number
  defaultReps: string
  restSeconds: number
  estSecondsPerSet: number // for session duration math
  runInterference: RunInterference
}

export interface SessionItem {
  exerciseId: string
  sets?: number // overrides exercise default if present
  reps?: string
  restSeconds?: number
  supersetWith?: string // exerciseId — optional pairing for 45-min templates
}

export interface SessionBlock {
  label: StrengthBlockLabel
  items: SessionItem[]
}

export interface StrengthSessionTemplate {
  id: string // 'rf-legs-core-beg'
  name: string
  goals: StrengthGoal[] // templates can serve multiple goals
  kind: StrengthSessionKind
  difficulty: Experience
  durationMinutes: 30 // authored at 30; resolveDuration compresses/extends
  blocks: SessionBlock[]
  runInterference: RunInterference
}

/** Fixed interference level per session kind (spec §2 design notes). */
export const KIND_INTERFERENCE: Record<StrengthSessionKind, RunInterference> = {
  legsAndCore: 'high',
  fullBody: 'medium',
  upperBody: 'low',
  coreAndMobility: 'low',
}
