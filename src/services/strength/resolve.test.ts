import { describe, expect, it } from 'vitest'
import { EXERCISE_BY_ID, STRENGTH_LIBRARY } from './library'
import { STRENGTH_TEMPLATES } from './templates'
import {
  blocksToSteps,
  canPerform,
  effectiveEquipment,
  estimateDurationMin,
  resolveDuration,
  resolveEquipment,
  resolveExercise,
  resolveSession,
} from './resolve'
import type { StrengthSessionKind } from '@/services/db/types'

const ALL_KINDS: StrengthSessionKind[] = ['legsAndCore', 'upperBody', 'fullBody', 'coreAndMobility']

describe('library integrity', () => {
  // 47 strength exercises plus the 10 run warm-up and cool-down mobility moves.
  it('ships exactly 57 exercises with unique ids', () => {
    expect(STRENGTH_LIBRARY).toHaveLength(57)
    const ids = new Set(STRENGTH_LIBRARY.map((e) => e.id))
    expect(ids.size).toBe(57)
  })

  it('every non-mobility category has at least one bodyweight option', () => {
    const cats = ['legs', 'core', 'push', 'pull'] as const
    for (const c of cats) {
      const bodyweight = STRENGTH_LIBRARY.filter((e) => e.category === c && e.equipment.includes('none'))
      expect(bodyweight.length, `category ${c}`).toBeGreaterThan(0)
    }
  })

  it('progression/regression references point to real exercises', () => {
    for (const e of STRENGTH_LIBRARY) {
      if (e.progressionOf) expect(EXERCISE_BY_ID[e.progressionOf]).toBeDefined()
      if (e.regressionOf) expect(EXERCISE_BY_ID[e.regressionOf]).toBeDefined()
    }
  })
})

describe('template integrity', () => {
  it('ships 12 templates (4 kinds × 3 difficulties)', () => {
    expect(STRENGTH_TEMPLATES).toHaveLength(12)
    for (const kind of ALL_KINDS) {
      const forKind = STRENGTH_TEMPLATES.filter((t) => t.kind === kind)
      expect(forKind.map((t) => t.difficulty).sort()).toEqual(['advanced', 'beginner', 'intermediate'])
    }
  })

  it('every template item references a real exercise', () => {
    for (const t of STRENGTH_TEMPLATES) {
      for (const b of t.blocks) {
        for (const item of b.items) {
          expect(EXERCISE_BY_ID[item.exerciseId], `${t.id}/${item.exerciseId}`).toBeDefined()
        }
      }
    }
  })
})

describe('effectiveEquipment', () => {
  it('always includes bodyweight', () => {
    expect(effectiveEquipment([]).has('none')).toBe(true)
  })
  it('gym implies band, dumbbells and pull-up bar', () => {
    const eff = effectiveEquipment(['gym'])
    expect(eff.has('dumbbells')).toBe(true)
    expect(eff.has('pullUpBar')).toBe(true)
    expect(eff.has('resistanceBand')).toBe(true)
  })
})

describe('resolveExercise', () => {
  it('keeps an exercise the user can perform', () => {
    expect(resolveExercise('bw-squat', ['none'])).toBe('bw-squat')
    expect(resolveExercise('overhead-press', ['dumbbells'])).toBe('overhead-press')
    expect(resolveExercise('pull-up', ['gym'])).toBe('pull-up')
  })

  it('swaps an equipment exercise for a same-category bodyweight variant', () => {
    const swapped = resolveExercise('overhead-press', ['none'])
    expect(swapped).not.toBe('overhead-press')
    expect(EXERCISE_BY_ID[swapped].category).toBe('push')
    expect(EXERCISE_BY_ID[swapped].equipment).toContain('none')
  })

  it('resolves pull-ups to a bodyweight pull option when no bar', () => {
    const swapped = resolveExercise('pull-up', ['none'])
    expect(EXERCISE_BY_ID[swapped].category).toBe('pull')
    expect(canPerform(EXERCISE_BY_ID[swapped], effectiveEquipment(['none']))).toBe(true)
  })
})

describe('resolveEquipment on templates', () => {
  it('every template resolves fully to performable exercises with bodyweight only', () => {
    for (const t of STRENGTH_TEMPLATES) {
      const resolved = resolveEquipment(t.blocks, ['none'])
      const eff = effectiveEquipment(['none'])
      for (const b of resolved) {
        for (const item of b.items) {
          expect(canPerform(EXERCISE_BY_ID[item.exerciseId], eff), `${t.id}/${item.exerciseId}`).toBe(true)
        }
      }
    }
  })
})

describe('resolveDuration', () => {
  const template = STRENGTH_TEMPLATES.find((t) => t.id === 'legs-core-int')!

  it('20 min drops the Finisher block', () => {
    const blocks = resolveDuration(template.blocks, 20)
    expect(blocks.some((b) => b.label === 'Finisher')).toBe(false)
  })

  it('30 min is unchanged', () => {
    expect(resolveDuration(template.blocks, 30)).toEqual(template.blocks)
  })

  it('45 min adds a set to Main/Core items', () => {
    const origMain = template.blocks.find((b) => b.label === 'Main')!
    const origFirst = origMain.items[0]
    const baseSets = origFirst.sets ?? EXERCISE_BY_ID[origFirst.exerciseId].defaultSets

    const blocks = resolveDuration(template.blocks, 45)
    const main = blocks.find((b) => b.label === 'Main')!
    expect(main.items[0].sets).toBe(baseSets + 1)
  })

  it('longer target yields a longer estimated duration', () => {
    const short = estimateDurationMin(resolveDuration(template.blocks, 20))
    const long = estimateDurationMin(resolveDuration(template.blocks, 45))
    expect(long).toBeGreaterThan(short)
  })
})

describe('blocksToSteps', () => {
  it('produces exercise steps tagged with block labels and ids', () => {
    const template = STRENGTH_TEMPLATES.find((t) => t.id === 'upper-int')!
    const steps = blocksToSteps(template.blocks)
    expect(steps.length).toBeGreaterThan(0)
    for (const s of steps) {
      expect(s.kind).toBe('exercise')
      if (s.kind === 'exercise') {
        expect(s.exerciseId).toBeTruthy()
        expect(s.block).toBeTruthy()
      }
    }
  })
})

describe('resolveSession pipeline', () => {
  it('resolves every kind at every difficulty for bodyweight users', () => {
    for (const kind of ALL_KINDS) {
      for (const difficulty of ['beginner', 'intermediate', 'advanced'] as const) {
        const r = resolveSession(STRENGTH_TEMPLATES, kind, difficulty, 30, ['none'])
        expect(r, `${kind}/${difficulty}`).not.toBeNull()
        expect(r!.steps.length).toBeGreaterThan(0)
        expect(r!.durationMin).toBeGreaterThan(0)
      }
    }
  })
})
