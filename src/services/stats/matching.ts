import type { Run, Session, SessionType } from '@/services/db/types'

// Session ↔ run matching (spec §4.5). Same-day, compatible type, distance ±25%.

const RUN_TYPES: SessionType[] = ['easy', 'tempo', 'intervals', 'hills', 'fartlek', 'long']

export function isRunnableSession(s: Session): boolean {
  return RUN_TYPES.includes(s.type)
}

export interface MatchResult {
  session: Session
  score: number // lower is better (relative distance difference)
}

/**
 * Find the best planned session on the run's date to auto-link. Returns null
 * when nothing is compatible (caller offers "log as extra run").
 */
export function findMatch(run: Run, sameDaySessions: Session[]): MatchResult | null {
  const candidates = sameDaySessions.filter(
    (s) => isRunnableSession(s) && s.status !== 'completed' && !s.linkedRunId,
  )
  let best: MatchResult | null = null
  for (const session of candidates) {
    const planned = session.plannedDistanceKm
    let score: number
    if (planned && planned > 0) {
      const diff = Math.abs(run.distanceKm - planned) / planned
      if (diff > 0.25) continue // outside ±25%
      score = diff
    } else {
      score = 0.25 // no planned distance → weak match, still allowed
    }
    if (!best || score < best.score) best = { session, score }
  }
  return best
}

export interface TargetComparison {
  targetLabel: string
  withinTarget: boolean
  deltaSecPerKm: number // + = slower than target band, − = faster, 0 = within
}

/** Compare a run's avg pace against a matched session's target band. */
export function compareToTarget(run: Run, session: Session): TargetComparison | null {
  const range = session.targetPaceRange
  if (!range) return null
  const p = run.avgPaceSecPerKm
  if (p >= range.minSecPerKm && p <= range.maxSecPerKm) {
    return { targetLabel: 'target', withinTarget: true, deltaSecPerKm: 0 }
  }
  if (p < range.minSecPerKm) {
    return { targetLabel: 'faster than target', withinTarget: false, deltaSecPerKm: p - range.minSecPerKm }
  }
  return { targetLabel: 'slower than target', withinTarget: false, deltaSecPerKm: p - range.maxSecPerKm }
}
