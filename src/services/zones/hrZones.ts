import type { HRZones, HRZone, Zone } from '@/services/db/types'

/** Nes formula max HR estimate (spec §1.4). */
export function estimateMaxHR(age: number): number {
  return Math.round(211 - 0.64 * age)
}

// Z1–Z5 as % of max HR (simple, reference-only).
const MAX_HR_BANDS: Record<Zone, [number, number]> = {
  Z1: [0.5, 0.6],
  Z2: [0.6, 0.7],
  Z3: [0.7, 0.8],
  Z4: [0.8, 0.9],
  Z5: [0.9, 1.0],
}

// Karvonen uses heart-rate reserve (% of (max − rest) + rest).
const HRR_BANDS: Record<Zone, [number, number]> = {
  Z1: [0.5, 0.6],
  Z2: [0.6, 0.7],
  Z3: [0.7, 0.8],
  Z4: [0.8, 0.9],
  Z5: [0.9, 1.0],
}

export function computeHRZones(age: number, maxHR?: number, restingHR?: number): HRZones {
  const max = maxHR ?? estimateMaxHR(age)
  const zoneKeys: Zone[] = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']

  if (restingHR && restingHR > 0 && restingHR < max) {
    const reserve = max - restingHR
    const zones: HRZone[] = zoneKeys.map((z) => {
      const [lo, hi] = HRR_BANDS[z]
      return {
        zone: z,
        minBpm: Math.round(restingHR + lo * reserve),
        maxBpm: Math.round(restingHR + hi * reserve),
      }
    })
    return { maxHR: max, restingHR, method: 'karvonen', zones }
  }

  const zones: HRZone[] = zoneKeys.map((z) => {
    const [lo, hi] = MAX_HR_BANDS[z]
    return { zone: z, minBpm: Math.round(lo * max), maxBpm: Math.round(hi * max) }
  })
  return { maxHR: max, method: 'nes', zones }
}
