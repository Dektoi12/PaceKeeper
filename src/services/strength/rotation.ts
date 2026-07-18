import type { StrengthGoal, StrengthSessionKind } from '@/services/db/types'

// Weekly rotation per goal at 3×/week (spec §6). Lower frequencies drop from the
// right, except 1×/week which is special-cased per the spec.

const ROTATION_3X: Record<StrengthGoal, StrengthSessionKind[]> = {
  runningFocus: ['legsAndCore', 'coreAndMobility', 'legsAndCore'],
  allRoundStrength: ['legsAndCore', 'upperBody', 'fullBody'],
  upperBodyFocus: ['upperBody', 'upperBody', 'coreAndMobility'],
}

const ROTATION_1X: Record<StrengthGoal, StrengthSessionKind> = {
  runningFocus: 'legsAndCore',
  allRoundStrength: 'fullBody',
  upperBodyFocus: 'upperBody',
}

/**
 * The strength session kinds to schedule in a given week. Order is rotated by
 * week number so placement priority varies gently week to week.
 */
export function weeklyKinds(
  goal: StrengthGoal,
  frequency: 1 | 2 | 3,
  weekNumber: number,
): StrengthSessionKind[] {
  if (frequency === 1) return [ROTATION_1X[goal]]
  const base = ROTATION_3X[goal].slice(0, frequency)
  const offset = (((weekNumber - 1) % base.length) + base.length) % base.length
  return base.slice(offset).concat(base.slice(0, offset))
}
