import type { RunInterference, StrengthSessionKind } from '@/services/db/types'
import { KIND_INTERFERENCE } from './types'

export type RunIntensity = 'easy' | 'hard' | 'long'

export interface DaySlot {
  date: string // ISO yyyy-MM-dd
  run?: RunIntensity // undefined = no run that day
}

export interface StrengthPlacementSlot {
  date: string
  kind: StrengthSessionKind
}

export interface ScheduleResult {
  placements: StrengthPlacementSlot[]
  dropped: StrengthSessionKind[]
}

const HIGH: RunInterference = 'high'

/** Rule 1: high-interference sessions may never sit the day before a hard/long run. */
function isDayBeforeHardOrLong(index: number, days: DaySlot[]): boolean {
  const next = days[index + 1]
  return !!next && (next.run === 'hard' || next.run === 'long')
}

/**
 * A day is a valid candidate for the given interference level. Strength work is
 * placed on non-run days (one session per day); run days stay in the array only
 * for adjacency context. Rule 1 forbids high-interference the day before a
 * hard/long run; rule 3 (no low-interference on a long-run day) is automatic
 * since long days are runs and thus never candidates.
 */
function isHardValid(index: number, days: DaySlot[], interference: RunInterference): boolean {
  if (days[index].run) return false // only place on non-run days
  if (interference === HIGH) return !isDayBeforeHardOrLong(index, days)
  return true
}

/**
 * Preference score among valid (non-run) days (lower = better). Rule 2 spirit:
 * consolidate stress — a high-interference session prefers the day right after a
 * hard/long run, keeping other easy days easy.
 */
function preferenceScore(index: number, days: DaySlot[], interference: RunInterference): number {
  if (interference !== HIGH) return 0
  const prev = days[index - 1]
  return prev && (prev.run === 'hard' || prev.run === 'long') ? 0 : 1
}

const dayIndex = (days: DaySlot[], date: string) => days.findIndex((d) => d.date === date)

/** Rule 4: keep ≥48h between two high-interference sessions. */
function violates48h(
  index: number,
  days: DaySlot[],
  placedHighDates: string[],
): boolean {
  for (const date of placedHighDates) {
    const other = dayIndex(days, date)
    if (other >= 0 && Math.abs(other - index) < 2) return true
  }
  return false
}

/**
 * Place the week's strength session kinds onto days (spec §7). Pure and
 * deterministic. Priority: never violate rule 1; relax rule 2 (preference) then
 * rule 4 (48h) before dropping the lowest-priority session.
 */
export function scheduleStrengthWeek(days: DaySlot[], kinds: StrengthSessionKind[]): ScheduleResult {
  const placements: StrengthPlacementSlot[] = []
  const dropped: StrengthSessionKind[] = []
  const usedDates = new Set<string>()
  const placedHighDates: string[] = []

  // High-interference kinds are hardest to fit — place them first.
  const ordered = [...kinds]
    .map((kind, i) => ({ kind, i }))
    .sort((a, b) => {
      const ha = KIND_INTERFERENCE[a.kind] === HIGH ? 0 : 1
      const hb = KIND_INTERFERENCE[b.kind] === HIGH ? 0 : 1
      return ha - hb || a.i - b.i
    })

  for (const { kind } of ordered) {
    const interference = KIND_INTERFERENCE[kind]

    const candidates = days
      .map((day, index) => ({ day, index }))
      .filter(({ day }) => !usedDates.has(day.date))
      .filter(({ index }) => isHardValid(index, days, interference))

    if (candidates.length === 0) {
      dropped.push(kind)
      continue
    }

    const ranked = [...candidates].sort(
      (a, b) =>
        preferenceScore(a.index, days, interference) - preferenceScore(b.index, days, interference),
    )

    // Prefer a day that also honours the 48h rule; otherwise relax rule 4.
    let choice =
      interference === HIGH
        ? ranked.find(({ index }) => !violates48h(index, days, placedHighDates)) ?? ranked[0]
        : ranked[0]

    placements.push({ date: choice.day.date, kind })
    usedDates.add(choice.day.date)
    if (interference === HIGH) placedHighDates.push(choice.day.date)
  }

  // Emit in calendar order for stable output.
  placements.sort((a, b) => a.date.localeCompare(b.date))
  return { placements, dropped }
}
