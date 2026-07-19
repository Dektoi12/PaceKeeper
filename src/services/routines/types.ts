export type RoutinePhase = 'warmup' | 'cooldown'

/**
 * One movement inside a run routine. Exactly one of `reps` / `seconds` is set:
 * `reps` items advance on a tap, `seconds` items run a countdown and auto-advance.
 */
export interface RoutineItem {
  exerciseId: string
  reps?: string
  seconds?: number
  /** Run the item twice with a "switch sides" cue in between. */
  perSide?: boolean
}

export interface RunRoutine {
  phase: RoutinePhase
  title: string
  subtitle: string
  items: RoutineItem[]
}