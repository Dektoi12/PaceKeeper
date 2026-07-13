export * from './vdot'
export * from './hrZones'

import { vdotFromRace, paceZonesFromVdot } from './vdot'
import { computeHRZones } from './hrZones'
import type { Assessment, PaceZones } from '@/services/db/types'

/**
 * Derive VDOT + pace zones from an assessment. For non-race methods we estimate
 * a benchmark-equivalent VDOT from weekly mileage / experience.
 */
export function vdotFromAssessment(a: Assessment): number {
  if (a.method === 'recentRace' || a.method === 'benchmarkRun') {
    if (a.distanceKm && a.timeSec) return vdotFromRace(a.distanceKm, a.timeSec)
  }
  if (a.method === 'weeklyMileage' && a.weeklyKm) {
    // Rough mapping: more consistent weekly volume ≈ higher aerobic base.
    // Clamped to a sane recreational range.
    const est = 30 + Math.min(a.weeklyKm, 80) * 0.35
    return Math.round(est)
  }
  return 38 // fallback middle-of-road recreational VDOT
}

export function paceZonesFromAssessment(a: Assessment): PaceZones {
  return paceZonesFromVdot(vdotFromAssessment(a))
}

export { computeHRZones }
