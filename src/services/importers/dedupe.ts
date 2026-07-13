import type { Run } from '@/services/db/types'
import type { RunImport } from './types'

const TOLERANCE = 0.02 // ±2% on distance and duration

function within(a: number, b: number, tol: number): boolean {
  if (a === 0 && b === 0) return true
  const ref = Math.max(Math.abs(a), Math.abs(b))
  return ref === 0 ? true : Math.abs(a - b) / ref <= tol
}

/**
 * Find an existing run that looks like the same activity as `candidate`:
 * same calendar date, distance and duration both within ±2%. Used to warn
 * before importing a file the user already logged.
 */
export function findDuplicate(candidate: RunImport, existing: Run[]): Run | null {
  for (const run of existing) {
    if (run.date !== candidate.date) continue
    if (!within(run.distanceKm, candidate.distanceKm, TOLERANCE)) continue
    if (!within(run.durationSec, candidate.durationSec, TOLERANCE)) continue
    return run
  }
  return null
}
