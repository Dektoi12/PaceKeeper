import { describe, expect, it } from 'vitest'
import type { StrengthPreferences, StrengthSessionKind } from '@/services/db/types'
import { scheduleStrengthWeek, type DaySlot, type RunIntensity } from './scheduler'
import { weeklyKinds } from './rotation'
import { KIND_INTERFERENCE } from './types'
import { strengthEngine } from './RuleBasedStrengthEngine'

// Monday-first week of ISO dates for a fixed reference week.
const WEEK = ['2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24', '2026-07-25', '2026-07-26']

/** Build a 7-slot week from a run-intensity map keyed by weekday index (0=Mon). */
function week(runs: Partial<Record<number, RunIntensity>>): DaySlot[] {
  return WEEK.map((date, i) => ({ date, run: runs[i] }))
}

const dateIndex = (date: string) => WEEK.indexOf(date)
const isHigh = (kind: StrengthSessionKind) => KIND_INTERFERENCE[kind] === 'high'

describe('weeklyKinds rotation', () => {
  it('1×/week uses the spec fallback kind per goal', () => {
    expect(weeklyKinds('runningFocus', 1, 1)).toEqual(['legsAndCore'])
    expect(weeklyKinds('allRoundStrength', 1, 1)).toEqual(['fullBody'])
    expect(weeklyKinds('upperBodyFocus', 1, 1)).toEqual(['upperBody'])
  })

  it('3×/week returns the full rotation for each goal', () => {
    expect(new Set(weeklyKinds('allRoundStrength', 3, 1))).toEqual(
      new Set(['legsAndCore', 'upperBody', 'fullBody']),
    )
    expect(new Set(weeklyKinds('upperBodyFocus', 3, 1))).toEqual(
      new Set(['upperBody', 'coreAndMobility']),
    )
  })

  it('2×/week drops from the right', () => {
    // allRoundStrength 3× = [legsAndCore, upperBody, fullBody]; 2× drops fullBody.
    expect(new Set(weeklyKinds('allRoundStrength', 2, 1))).toEqual(
      new Set(['legsAndCore', 'upperBody']),
    )
  })
})

describe('scheduleStrengthWeek — rule 1 (never day before hard/long)', () => {
  it('never places a high-interference session the day before a hard run', () => {
    // Runs: Tue easy, Thu hard, Sat long. Legs&Core must avoid Wed (before Thu hard) and Fri (before Sat long).
    const days = week({ 1: 'easy', 3: 'hard', 5: 'long' })
    const { placements } = scheduleStrengthWeek(days, ['legsAndCore', 'legsAndCore'])
    for (const p of placements.filter((x) => isHigh(x.kind))) {
      const i = dateIndex(p.date)
      const next = days[i + 1]
      expect(next?.run === 'hard' || next?.run === 'long').toBe(false)
    }
  })

  it('never places high-interference the day before the long run even under pressure', () => {
    const days = week({ 0: 'easy', 1: 'hard', 2: 'easy', 3: 'hard', 4: 'easy', 6: 'long' })
    // Fri (index 4) is before Sat rest, Sat (5) is day before Sun long → must be avoided by high.
    const { placements } = scheduleStrengthWeek(days, ['legsAndCore'])
    for (const p of placements.filter((x) => isHigh(x.kind))) {
      const i = dateIndex(p.date)
      expect(days[i + 1]?.run).not.toBe('long')
    }
  })
})

describe('scheduleStrengthWeek — rule 3 (low interference)', () => {
  it('never places a low-interference session on the same day as a long run', () => {
    const days = week({ 1: 'easy', 3: 'hard', 5: 'long' })
    const { placements } = scheduleStrengthWeek(days, ['coreAndMobility'])
    for (const p of placements) {
      expect(days[dateIndex(p.date)].run).not.toBe('long')
    }
  })

  it('allows a low-interference session the day before a hard run', () => {
    // Only open non-long slot before Wed hard is Tue; low interference should accept it.
    const days = week({ 2: 'hard' })
    const { placements, dropped } = scheduleStrengthWeek(days, ['coreAndMobility'])
    expect(dropped).toHaveLength(0)
    expect(placements).toHaveLength(1)
  })
})

describe('scheduleStrengthWeek — rule 4 (48h between high sessions)', () => {
  it('keeps two high-interference sessions at least 2 days apart when possible', () => {
    // Plenty of rest days (only one easy run) → 48h separation is achievable.
    // Both legsAndCore sessions are high-interference.
    const days = week({ 3: 'easy' })
    const { placements, dropped } = scheduleStrengthWeek(days, ['legsAndCore', 'legsAndCore'])
    expect(dropped).toHaveLength(0)
    const highDates = placements.filter((p) => isHigh(p.kind)).map((p) => dateIndex(p.date))
    expect(Math.abs(highDates[0] - highDates[1])).toBeGreaterThanOrEqual(2)
  })
})

describe('scheduleStrengthWeek — rule 5 (drop under load)', () => {
  it('drops the excess session when 6 run days leave no valid slot', () => {
    // 6 run days incl. hard/long; 3 strength requested. Some must drop, none may break rule 1.
    const days = week({ 0: 'easy', 1: 'hard', 2: 'easy', 3: 'hard', 4: 'easy', 5: 'long' })
    const kinds: StrengthSessionKind[] = ['legsAndCore', 'upperBody', 'fullBody']
    const { placements, dropped } = scheduleStrengthWeek(days, kinds)
    expect(placements.length + dropped.length).toBe(3)
    // Whatever got placed must still respect rule 1.
    for (const p of placements.filter((x) => isHigh(x.kind))) {
      const next = days[dateIndex(p.date) + 1]
      expect(next?.run === 'hard' || next?.run === 'long').toBe(false)
    }
  })

  it('never places two strength sessions on the same day', () => {
    const days = week({ 5: 'long' })
    const { placements } = scheduleStrengthWeek(days, ['legsAndCore', 'upperBody', 'coreAndMobility'])
    const dates = placements.map((p) => p.date)
    expect(new Set(dates).size).toBe(dates.length)
  })
})

describe('RuleBasedStrengthEngine.scheduleWeek', () => {
  const prefs: StrengthPreferences = {
    enabled: true,
    goal: 'allRoundStrength',
    experienceLevel: 'intermediate',
    equipment: ['none'],
    sessionLengthMinutes: 30,
    frequencyPerWeek: 3,
    updatedAt: 0,
  }

  it('produces resolved sessions with steps and duration', () => {
    const days = week({ 1: 'easy', 3: 'hard', 5: 'long' })
    const result = strengthEngine.scheduleWeek({ weekNumber: 1, days, prefs })
    expect(result.placements.length).toBeGreaterThan(0)
    for (const p of result.placements) {
      expect(p.steps.length).toBeGreaterThan(0)
      expect(p.durationMin).toBeGreaterThan(0)
      expect(p.sessionType === 'strength' || p.sessionType === 'mobility').toBe(true)
    }
  })

  it('maps coreAndMobility placements to the mobility session type', () => {
    const upperPrefs: StrengthPreferences = { ...prefs, goal: 'upperBodyFocus', frequencyPerWeek: 3 }
    const days = week({ 2: 'easy', 5: 'long' })
    const result = strengthEngine.scheduleWeek({ weekNumber: 1, days, prefs: upperPrefs })
    const mob = result.placements.find((p) => p.kind === 'coreAndMobility')
    if (mob) expect(mob.sessionType).toBe('mobility')
  })
})
