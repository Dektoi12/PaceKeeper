import { getExercise } from '@/services/strength/library'
import type { RoutineItem, RoutinePhase, RunRoutine } from './types'

export type { RoutineItem, RoutinePhase, RunRoutine } from './types'

/**
 * Static run routines. These are app content, not per-session data — they are
 * resolved at render time for any runnable session, so existing plans pick them
 * up without a migration. The zone-jog `warmup`/`cooldown` WorkoutSteps that
 * quality sessions already carry are unaffected.
 */

const RUN_WARMUP: RunRoutine = {
  phase: 'warmup',
  title: 'Dynamic warm-up',
  subtitle: 'Wake up the hips and ankles before you run.',
  items: [
    { exerciseId: 'leg-swings', reps: '10 / direction' },
    { exerciseId: 'hip-circles', reps: '8 / direction' },
    { exerciseId: 'walking-lunge', reps: '5 / leg' },
    { exerciseId: 'worlds-greatest-stretch', reps: '4 / side' },
    { exerciseId: 'high-knees', seconds: 20 },
    { exerciseId: 'butt-kicks', seconds: 20 },
    { exerciseId: 'ankle-hops', seconds: 15 },
  ],
}

const RUN_COOLDOWN: RunRoutine = {
  phase: 'cooldown',
  title: 'Cool-down stretches',
  subtitle: 'Hold each stretch and let the breathing settle.',
  items: [
    { exerciseId: 'quad-stretch', seconds: 30, perSide: true },
    { exerciseId: 'calf-stretch', seconds: 30, perSide: true },
    { exerciseId: 'hamstring-stretch', seconds: 30, perSide: true },
    { exerciseId: 'hip-flexor-stretch', seconds: 30, perSide: true },
    { exerciseId: 'figure-4-stretch', seconds: 30, perSide: true },
    { exerciseId: 'cat-cow', reps: '8 flows' },
  ],
}

export const RUN_ROUTINES: Record<RoutinePhase, RunRoutine> = {
  warmup: RUN_WARMUP,
  cooldown: RUN_COOLDOWN,
}

export function getRunRoutine(phase: RoutinePhase): RunRoutine {
  return RUN_ROUTINES[phase]
}

export function isRoutinePhase(value: string | undefined): value is RoutinePhase {
  return value === 'warmup' || value === 'cooldown'
}

/** Seconds an item takes, counting both sides when `perSide` is set. */
export function itemSeconds(item: RoutineItem): number {
  const base = item.seconds ?? getExercise(item.exerciseId)?.estSecondsPerSet ?? 30
  return item.perSide && item.seconds ? base * 2 : base
}

/** Rounded-up minutes for the whole routine, plus a few seconds of transition per item. */
export function estimateRoutineMinutes(routine: RunRoutine): number {
  const total = routine.items.reduce((sum, item) => sum + itemSeconds(item) + 5, 0)
  return Math.max(1, Math.round(total / 60))
}