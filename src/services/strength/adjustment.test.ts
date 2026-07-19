import { describe, expect, it } from 'vitest'
import type { Session, StrengthPreferences } from '@/services/db/types'
import { strengthEngine } from './RuleBasedStrengthEngine'

const BASE_PREFS: StrengthPreferences = {
  enabled: true,
  goal: 'allRoundStrength',
  experienceLevel: 'intermediate',
  equipment: ['none'],
  sessionLengthMinutes: 30,
  frequencyPerWeek: 3,
  updatedAt: 0,
}

let seq = 0
function makeSession(overrides: Partial<Session>): Session {
  seq++
  return {
    id: `s${seq}`,
    planId: 'p1',
    date: `2026-07-${String(10 + seq).padStart(2, '0')}`,
    weekNumber: 1,
    dayOfWeek: 1,
    type: 'strength',
    title: 'Full Body',
    description: '',
    steps: [],
    status: 'completed',
    strength: { templateId: 't1', kind: 'fullBody', runInterference: 'medium' },
    ...overrides,
  }
}

describe('suggestAdjustment', () => {
  it('returns null when strength is disabled', () => {
    const sessions = [makeSession({ status: 'skipped' }), makeSession({ status: 'skipped' })]
    expect(strengthEngine.suggestAdjustment(sessions, { ...BASE_PREFS, enabled: false })).toBeNull()
  })

  it('returns null with no terminal (completed/skipped) sessions', () => {
    const sessions = [makeSession({ status: 'upcoming' }), makeSession({ status: 'inProgress' })]
    expect(strengthEngine.suggestAdjustment(sessions, BASE_PREFS)).toBeNull()
  })

  it('suggests reducing frequency after 2 consecutive trailing skips', () => {
    const sessions = [
      makeSession({ status: 'completed' }),
      makeSession({ status: 'skipped' }),
      makeSession({ status: 'skipped' }),
    ]
    const adj = strengthEngine.suggestAdjustment(sessions, BASE_PREFS)
    expect(adj?.kind).toBe('reduceFrequency')
    expect(adj?.patch.frequencyPerWeek).toBe(2)
  })

  it('does not suggest reducing frequency below 1×/week', () => {
    const sessions = [makeSession({ status: 'skipped' }), makeSession({ status: 'skipped' })]
    const adj = strengthEngine.suggestAdjustment(sessions, { ...BASE_PREFS, frequencyPerWeek: 1 })
    expect(adj).toBeNull()
  })

  it('does not trigger on a single skip', () => {
    const sessions = [makeSession({ status: 'completed' }), makeSession({ status: 'skipped' })]
    expect(strengthEngine.suggestAdjustment(sessions, BASE_PREFS)).toBeNull()
  })

  it('a completion breaks the trailing skip streak', () => {
    const sessions = [
      makeSession({ status: 'skipped' }),
      makeSession({ status: 'skipped' }),
      makeSession({ status: 'completed' }),
    ]
    expect(strengthEngine.suggestAdjustment(sessions, BASE_PREFS)).toBeNull()
  })

  it('suggests increasing difficulty after 3 low-effort completions', () => {
    const sessions = [
      makeSession({ status: 'completed', strengthLog: { completedExerciseIds: [], perceivedEffort: 2 } }),
      makeSession({ status: 'completed', strengthLog: { completedExerciseIds: [], perceivedEffort: 1 } }),
      makeSession({ status: 'completed', strengthLog: { completedExerciseIds: [], perceivedEffort: 2 } }),
    ]
    const adj = strengthEngine.suggestAdjustment(sessions, BASE_PREFS)
    expect(adj?.kind).toBe('increaseDifficulty')
    expect(adj?.patch.experienceLevel).toBe('advanced')
  })

  it('suggests decreasing difficulty after 3 high-effort completions', () => {
    const sessions = [
      makeSession({ status: 'completed', strengthLog: { completedExerciseIds: [], perceivedEffort: 5 } }),
      makeSession({ status: 'completed', strengthLog: { completedExerciseIds: [], perceivedEffort: 5 } }),
      makeSession({ status: 'completed', strengthLog: { completedExerciseIds: [], perceivedEffort: 5 } }),
    ]
    const adj = strengthEngine.suggestAdjustment(sessions, BASE_PREFS)
    expect(adj?.kind).toBe('decreaseDifficulty')
    expect(adj?.patch.experienceLevel).toBe('beginner')
  })

  it('does not suggest increasing difficulty beyond advanced', () => {
    const sessions = [
      makeSession({ status: 'completed', strengthLog: { completedExerciseIds: [], perceivedEffort: 1 } }),
      makeSession({ status: 'completed', strengthLog: { completedExerciseIds: [], perceivedEffort: 1 } }),
      makeSession({ status: 'completed', strengthLog: { completedExerciseIds: [], perceivedEffort: 1 } }),
    ]
    expect(
      strengthEngine.suggestAdjustment(sessions, { ...BASE_PREFS, experienceLevel: 'advanced' }),
    ).toBeNull()
  })

  it('does not suggest decreasing difficulty below beginner', () => {
    const sessions = [
      makeSession({ status: 'completed', strengthLog: { completedExerciseIds: [], perceivedEffort: 5 } }),
      makeSession({ status: 'completed', strengthLog: { completedExerciseIds: [], perceivedEffort: 5 } }),
      makeSession({ status: 'completed', strengthLog: { completedExerciseIds: [], perceivedEffort: 5 } }),
    ]
    expect(
      strengthEngine.suggestAdjustment(sessions, { ...BASE_PREFS, experienceLevel: 'beginner' }),
    ).toBeNull()
  })

  it('mixed effort levels over the last 3 completions triggers no suggestion', () => {
    const sessions = [
      makeSession({ status: 'completed', strengthLog: { completedExerciseIds: [], perceivedEffort: 2 } }),
      makeSession({ status: 'completed', strengthLog: { completedExerciseIds: [], perceivedEffort: 4 } }),
      makeSession({ status: 'completed', strengthLog: { completedExerciseIds: [], perceivedEffort: 3 } }),
    ]
    expect(strengthEngine.suggestAdjustment(sessions, BASE_PREFS)).toBeNull()
  })

  it('ignores non-strength sessions in the input', () => {
    const sessions = [
      makeSession({ status: 'skipped', strength: undefined, type: 'easy' }),
      makeSession({ status: 'skipped', strength: undefined, type: 'easy' }),
    ]
    expect(strengthEngine.suggestAdjustment(sessions, BASE_PREFS)).toBeNull()
  })
})
