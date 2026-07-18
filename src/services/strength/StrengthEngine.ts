import type {
  RunInterference,
  StrengthPreferences,
  StrengthSessionKind,
  WorkoutStep,
} from '@/services/db/types'
import type { DaySlot } from './scheduler'

/** A scheduled strength/mobility session, before it's turned into a Session row. */
export interface StrengthPlacement {
  date: string
  sessionType: 'strength' | 'mobility'
  kind: StrengthSessionKind
  templateId: string
  title: string
  steps: WorkoutStep[]
  durationMin: number
  runInterference: RunInterference
}

export interface ScheduleWeekInput {
  weekNumber: number
  days: DaySlot[] // 7 slots, Monday-first, each tagged with its run intensity (if any)
  prefs: StrengthPreferences
}

export interface ScheduleWeekResult {
  placements: StrengthPlacement[]
  droppedCount: number // sessions the rules couldn't fit this week (spec §7 rule 5)
}

/**
 * Mirrors CoachEngine: a swappable strategy for placing strength work around
 * runs. v1 = RuleBasedStrengthEngine; an AI-adaptive engine can drop in later.
 */
export interface StrengthEngine {
  scheduleWeek(input: ScheduleWeekInput): ScheduleWeekResult
}
