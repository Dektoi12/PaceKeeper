import { useLiveQuery } from 'dexie-react-hooks'
import { db, PROFILE_ID, SETTINGS_ID } from '@/services/db'
import type { Units } from '@/services/db/types'

export function useProfile() {
  return useLiveQuery(() => db.profile.get(PROFILE_ID), [])
}

/** Units with a safe default before the profile loads. */
export function useUnits(): Units {
  const profile = useProfile()
  return profile?.units ?? 'km'
}

export function useActivePlan() {
  return useLiveQuery(async () => {
    const plans = await db.plans.where('status').equals('active').toArray()
    return plans[0]
  }, [])
}

export function useActiveGoal() {
  return useLiveQuery(async () => {
    const goals = await db.goals.where('status').equals('active').toArray()
    return goals[0]
  }, [])
}

export function useLatestAssessment() {
  return useLiveQuery(async () => {
    const all = await db.assessments.orderBy('date').toArray()
    return all[all.length - 1]
  }, [])
}

/** App settings singleton (read-only; seeded once at startup in main.tsx). */
export function useSettings() {
  return useLiveQuery(() => db.settings.get(SETTINGS_ID), [])
}
