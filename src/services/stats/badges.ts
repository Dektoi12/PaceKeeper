import { db } from '@/services/db/db'
import type { Achievement, PRRecord, Run } from '@/services/db/types'
import { uid } from '@/lib/id'

// Achievement badges (spec §5). Definitions are data, evaluated against the full
// run history + PR records so unlocking is idempotent and recomputable.

export interface BadgeDef {
  id: string
  label: string
  emoji: string
  description: string
  earned: (ctx: BadgeContext) => boolean
}

interface BadgeContext {
  runs: Run[]
  records: PRRecord[]
  totalKm: number
  maxDistanceKm: number
  longestStreak: number
}

function hasNegativeSplit(runs: Run[]): boolean {
  return runs.some((r) => {
    if (!r.splits || r.splits.length < 2) return false
    const mid = Math.floor(r.splits.length / 2)
    const first = r.splits.slice(0, mid)
    const second = r.splits.slice(mid)
    const avg = (arr: typeof r.splits) => arr.reduce((s, x) => s + x.paceSecPerKm, 0) / arr.length
    return avg(second) < avg(first) // faster (lower pace) in the back half
  })
}

export const BADGES: BadgeDef[] = [
  { id: 'first-run', label: 'First steps', emoji: '👟', description: 'Logged your first run', earned: (c) => c.runs.length >= 1 },
  { id: 'five-k', label: '5K club', emoji: '5️⃣', description: 'Ran 5 km or more', earned: (c) => c.maxDistanceKm >= 5 },
  { id: 'ten-k', label: '10K club', emoji: '🔟', description: 'Ran 10 km or more', earned: (c) => c.maxDistanceKm >= 10 },
  { id: 'half', label: 'Half marathoner', emoji: '🎽', description: 'Ran a half-marathon distance', earned: (c) => c.maxDistanceKm >= 21.0975 },
  { id: 'marathon', label: 'Marathoner', emoji: '🏅', description: 'Ran a marathon distance', earned: (c) => c.maxDistanceKm >= 42.195 },
  { id: 'ten-runs', label: 'Getting consistent', emoji: '📅', description: 'Logged 10 runs', earned: (c) => c.runs.length >= 10 },
  { id: 'century', label: 'Century', emoji: '💯', description: '100 km logged in total', earned: (c) => c.totalKm >= 100 },
  { id: 'streak-7', label: 'Week on fire', emoji: '🔥', description: '7-day running streak', earned: (c) => c.longestStreak >= 7 },
  { id: 'negative-split', label: 'Negative split', emoji: '⚡', description: 'Finished a run faster than you started', earned: (c) => hasNegativeSplit(c.runs) },
  { id: 'climber', label: 'Climber', emoji: '⛰️', description: '100 m of elevation gain in one run', earned: (c) => c.runs.some((r) => (r.elevationGainM ?? 0) >= 100) },
]

export const BADGES_BY_ID: Record<string, BadgeDef> = Object.fromEntries(BADGES.map((b) => [b.id, b]))

/**
 * Evaluate all badges against the current history and unlock any newly earned
 * ones into `db.achievements`. Returns the badge defs unlocked this call.
 */
export async function evaluateBadges(runs: Run[], records: PRRecord[]): Promise<BadgeDef[]> {
  const ctx: BadgeContext = {
    runs,
    records,
    totalKm: runs.reduce((s, r) => s + r.distanceKm, 0),
    maxDistanceKm: runs.reduce((m, r) => Math.max(m, r.distanceKm), 0),
    longestStreak: records.find((r) => r.kind === 'longestStreak')?.value ?? 0,
  }

  const newly: BadgeDef[] = []
  await db.transaction('rw', db.achievements, async () => {
    const existing = await db.achievements.toArray()
    const have = new Set(existing.map((a) => a.badgeId))
    for (const badge of BADGES) {
      if (have.has(badge.id)) continue
      if (!badge.earned(ctx)) continue
      const achievement: Achievement = { id: uid(), badgeId: badge.id, unlockedAt: Date.now() }
      await db.achievements.put(achievement)
      newly.push(badge)
    }
  })
  return newly
}
