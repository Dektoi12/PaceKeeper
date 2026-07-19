import { describe, expect, it } from 'vitest'
import { EXERCISE_BY_ID } from '@/services/strength/library'
import { RUN_ROUTINES, estimateRoutineMinutes, getRunRoutine, isRoutinePhase } from './index'

const ROUTINES = Object.values(RUN_ROUTINES)

describe('run routines', () => {
  it('references only exercises that exist in the library', () => {
    for (const routine of ROUTINES) {
      for (const item of routine.items) {
        expect(EXERCISE_BY_ID[item.exerciseId], `missing exercise ${item.exerciseId}`).toBeDefined()
      }
    }
  })

  it('gives every item exactly one of reps or seconds', () => {
    for (const routine of ROUTINES) {
      for (const item of routine.items) {
        expect(
          (item.reps === undefined) !== (item.seconds === undefined),
          `${item.exerciseId} must set exactly one of reps/seconds`,
        ).toBe(true)
      }
    }
  })

  it('only marks timed items as per-side', () => {
    for (const routine of ROUTINES) {
      for (const item of routine.items) {
        if (item.perSide) expect(item.seconds).toBeDefined()
      }
    }
  })

  it('estimates each routine between 4 and 8 minutes', () => {
    for (const routine of ROUTINES) {
      const minutes = estimateRoutineMinutes(routine)
      expect(minutes, `${routine.phase} is ${minutes} min`).toBeGreaterThanOrEqual(4)
      expect(minutes, `${routine.phase} is ${minutes} min`).toBeLessThanOrEqual(8)
    }
  })

  it('resolves routines by phase', () => {
    expect(getRunRoutine('warmup').phase).toBe('warmup')
    expect(getRunRoutine('cooldown').phase).toBe('cooldown')
    expect(isRoutinePhase('warmup')).toBe(true)
    expect(isRoutinePhase('nope')).toBe(false)
    expect(isRoutinePhase(undefined)).toBe(false)
  })
})