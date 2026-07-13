import type { Goal, GoalType, Run } from '@/services/db/types'
import { vdotFromRace, predictTimeSec } from '@/services/zones/vdot'
import { fromISO } from '@/lib/dates'

// Race-time prediction (spec §5), built on the existing Jack Daniels VDOT model.
// We take the athlete's best recent effort (highest implied VDOT), then project
// equivalent times across the standard distances and the gap to their goal.

export const RACE_DISTANCES: { key: 'r5k' | 'r10k' | 'rHalf' | 'rFull'; label: string; km: number }[] = [
  { key: 'r5k', label: '5K', km: 5 },
  { key: 'r10k', label: '10K', km: 10 },
  { key: 'rHalf', label: 'Half', km: 21.0975 },
  { key: 'rFull', label: 'Marathon', km: 42.195 },
]

const GOAL_DISTANCE_KM: Partial<Record<GoalType, number>> = {
  '5k': 5,
  '10k': 10,
  half: 21.0975,
  full: 42.195,
  ultra: 50,
}

const MIN_EFFORT_KM = 2 // ignore very short efforts as predictors
const RECENT_DAYS = 120

export interface Prediction {
  label: string
  km: number
  timeSec: number
}

export interface GoalProjection {
  distanceKm: number
  targetTimeSec: number
  predictedTimeSec: number
  gapSec: number // + = predicted slower than goal (work to do), − = ahead
}

export interface RacePrediction {
  vdot: number
  basisRunId: string
  predictions: Prediction[]
  goal?: GoalProjection
}

/** Best (highest-VDOT) recent run, used as the prediction basis. */
function bestRecentEffort(runs: Run[]): { run: Run; vdot: number } | null {
  const cutoff = Date.now() - RECENT_DAYS * 86_400_000
  let best: { run: Run; vdot: number } | null = null
  for (const r of runs) {
    if (r.distanceKm < MIN_EFFORT_KM || r.durationSec <= 0) continue
    if (fromISO(r.date).getTime() < cutoff) continue
    const vdot = vdotFromRace(r.distanceKm, r.durationSec)
    if (!best || vdot > best.vdot) best = { run: r, vdot }
  }
  return best
}

export function predictRaces(runs: Run[], goal?: Goal): RacePrediction | null {
  const basis = bestRecentEffort(runs)
  if (!basis) return null
  const vdot = Math.round(basis.vdot * 10) / 10

  const predictions = RACE_DISTANCES.map((d) => ({
    label: d.label,
    km: d.km,
    timeSec: Math.round(predictTimeSec(basis.vdot, d.km)),
  }))

  let projection: GoalProjection | undefined
  const goalKm = goal ? GOAL_DISTANCE_KM[goal.type] : undefined
  if (goal && goalKm && goal.targetTime) {
    const predictedTimeSec = Math.round(predictTimeSec(basis.vdot, goalKm))
    projection = {
      distanceKm: goalKm,
      targetTimeSec: goal.targetTime,
      predictedTimeSec,
      gapSec: predictedTimeSec - goal.targetTime,
    }
  }

  return { vdot, basisRunId: basis.run.id, predictions, goal: projection }
}
