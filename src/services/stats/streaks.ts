import type { Session } from '@/services/db/types'
import { weekStartISO, fromISO } from '@/lib/dates'

// Weekly consistency streak (spec §5): a week "counts" when the athlete
// completed at least 75% of that week's planned sessions (rest days excluded).

const HIT_THRESHOLD = 0.75

export interface StreakResult {
  current: number
  longest: number
}

interface WeekTally {
  week: string
  planned: number
  completed: number
}

function tallyByWeek(sessions: Session[]): WeekTally[] {
  const map = new Map<string, WeekTally>()
  for (const s of sessions) {
    if (s.type === 'rest') continue
    const week = weekStartISO(fromISO(s.date))
    const t = map.get(week) ?? { week, planned: 0, completed: 0 }
    t.planned += 1
    if (s.status === 'completed') t.completed += 1
    map.set(week, t)
  }
  return Array.from(map.values()).sort((a, b) => (a.week < b.week ? -1 : 1))
}

/** Current (trailing) and longest run of consecutive weeks hitting ≥75%. */
export function computeWeeklyStreak(sessions: Session[]): StreakResult {
  const weeks = tallyByWeek(sessions)
  const hits = weeks.map((w) => w.planned > 0 && w.completed / w.planned >= HIT_THRESHOLD)

  let longest = 0
  let run = 0
  for (const hit of hits) {
    run = hit ? run + 1 : 0
    longest = Math.max(longest, run)
  }

  // Current streak: count back from the most recent week.
  let current = 0
  for (let i = hits.length - 1; i >= 0; i--) {
    if (hits[i]) current += 1
    else break
  }

  return { current, longest }
}
