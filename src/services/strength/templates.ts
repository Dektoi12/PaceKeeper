import { KIND_INTERFERENCE, type StrengthSessionTemplate } from './types'

// v1 = 12 templates: 4 kinds × 3 difficulties. Authored at 30 min; resolve.ts
// compresses to 20 (drop Finisher) or extends to 45 (+1 set on Main/Core).
// Exercise ids reference library.ts; equipment resolution swaps as needed.

const WARMUP_LEGS = { label: 'Warm-up' as const, items: [{ exerciseId: 'leg-swings' }, { exerciseId: 'worlds-greatest-stretch' }] }
const WARMUP_UPPER = { label: 'Warm-up' as const, items: [{ exerciseId: 'worlds-greatest-stretch' }, { exerciseId: 'cat-cow' }] }
const COOLDOWN = { label: 'Cooldown' as const, items: [{ exerciseId: 'cat-cow' }] }

export const STRENGTH_TEMPLATES: StrengthSessionTemplate[] = [
  // ---- Legs & Core (runningFocus, allRoundStrength) ----
  {
    id: 'legs-core-beg',
    name: 'Legs & Core — Foundation',
    goals: ['runningFocus', 'allRoundStrength'],
    kind: 'legsAndCore',
    difficulty: 'beginner',
    durationMinutes: 30,
    runInterference: KIND_INTERFERENCE.legsAndCore,
    blocks: [
      WARMUP_LEGS,
      { label: 'Main', items: [{ exerciseId: 'bw-squat' }, { exerciseId: 'glute-bridge' }, { exerciseId: 'calf-raise' }] },
      { label: 'Core', items: [{ exerciseId: 'dead-bug' }, { exerciseId: 'plank' }] },
      { label: 'Finisher', items: [{ exerciseId: 'mountain-climber' }] },
      COOLDOWN,
    ],
  },
  {
    id: 'legs-core-int',
    name: 'Legs & Core — Build',
    goals: ['runningFocus', 'allRoundStrength'],
    kind: 'legsAndCore',
    difficulty: 'intermediate',
    durationMinutes: 30,
    runInterference: KIND_INTERFERENCE.legsAndCore,
    blocks: [
      WARMUP_LEGS,
      { label: 'Main', items: [{ exerciseId: 'split-squat' }, { exerciseId: 'single-leg-glute-bridge' }, { exerciseId: 'calf-raise' }] },
      { label: 'Core', items: [{ exerciseId: 'hollow-hold' }, { exerciseId: 'side-plank' }] },
      { label: 'Finisher', items: [{ exerciseId: 'mountain-climber' }] },
      COOLDOWN,
    ],
  },
  {
    id: 'legs-core-adv',
    name: 'Legs & Core — Peak',
    goals: ['runningFocus', 'allRoundStrength'],
    kind: 'legsAndCore',
    difficulty: 'advanced',
    durationMinutes: 30,
    runInterference: KIND_INTERFERENCE.legsAndCore,
    blocks: [
      WARMUP_LEGS,
      { label: 'Main', items: [{ exerciseId: 'bulgarian-split-squat' }, { exerciseId: 'single-leg-glute-bridge' }, { exerciseId: 'calf-raise' }] },
      { label: 'Core', items: [{ exerciseId: 'hollow-hold' }, { exerciseId: 'side-plank' }] },
      { label: 'Finisher', items: [{ exerciseId: 'mountain-climber' }] },
      COOLDOWN,
    ],
  },

  // ---- Upper Body (allRoundStrength, upperBodyFocus) ----
  {
    id: 'upper-beg',
    name: 'Upper Body — Foundation',
    goals: ['allRoundStrength', 'upperBodyFocus'],
    kind: 'upperBody',
    difficulty: 'beginner',
    durationMinutes: 30,
    runInterference: KIND_INTERFERENCE.upperBody,
    blocks: [
      WARMUP_UPPER,
      { label: 'Main', items: [{ exerciseId: 'incline-push-up' }, { exerciseId: 'band-row' }, { exerciseId: 'pike-push-up' }] },
      { label: 'Core', items: [{ exerciseId: 'plank' }, { exerciseId: 'bird-dog' }] },
      { label: 'Finisher', items: [{ exerciseId: 'mountain-climber' }] },
      COOLDOWN,
    ],
  },
  {
    id: 'upper-int',
    name: 'Upper Body — Build',
    goals: ['allRoundStrength', 'upperBodyFocus'],
    kind: 'upperBody',
    difficulty: 'intermediate',
    durationMinutes: 30,
    runInterference: KIND_INTERFERENCE.upperBody,
    blocks: [
      WARMUP_UPPER,
      { label: 'Main', items: [{ exerciseId: 'push-up' }, { exerciseId: 'dumbbell-row' }, { exerciseId: 'pike-push-up' }, { exerciseId: 'overhead-press' }] },
      { label: 'Core', items: [{ exerciseId: 'hollow-hold' }, { exerciseId: 'side-plank' }] },
      { label: 'Finisher', items: [{ exerciseId: 'mountain-climber' }] },
      COOLDOWN,
    ],
  },
  {
    id: 'upper-adv',
    name: 'Upper Body — Peak',
    goals: ['allRoundStrength', 'upperBodyFocus'],
    kind: 'upperBody',
    difficulty: 'advanced',
    durationMinutes: 30,
    runInterference: KIND_INTERFERENCE.upperBody,
    blocks: [
      WARMUP_UPPER,
      { label: 'Main', items: [{ exerciseId: 'diamond-push-up' }, { exerciseId: 'pull-up' }, { exerciseId: 'pike-push-up' }, { exerciseId: 'overhead-press' }] },
      { label: 'Core', items: [{ exerciseId: 'hollow-hold' }, { exerciseId: 'side-plank' }] },
      { label: 'Finisher', items: [{ exerciseId: 'negative-pull-up' }] },
      COOLDOWN,
    ],
  },

  // ---- Full Body (allRoundStrength, runningFocus light) ----
  {
    id: 'full-beg',
    name: 'Full Body — Foundation',
    goals: ['allRoundStrength', 'runningFocus'],
    kind: 'fullBody',
    difficulty: 'beginner',
    durationMinutes: 30,
    runInterference: KIND_INTERFERENCE.fullBody,
    blocks: [
      WARMUP_LEGS,
      { label: 'Main', items: [{ exerciseId: 'bw-squat' }, { exerciseId: 'incline-push-up' }, { exerciseId: 'band-row' }, { exerciseId: 'glute-bridge' }] },
      { label: 'Core', items: [{ exerciseId: 'plank' }, { exerciseId: 'dead-bug' }] },
      { label: 'Finisher', items: [{ exerciseId: 'mountain-climber' }] },
      COOLDOWN,
    ],
  },
  {
    id: 'full-int',
    name: 'Full Body — Build',
    goals: ['allRoundStrength', 'runningFocus'],
    kind: 'fullBody',
    difficulty: 'intermediate',
    durationMinutes: 30,
    runInterference: KIND_INTERFERENCE.fullBody,
    blocks: [
      WARMUP_LEGS,
      { label: 'Main', items: [{ exerciseId: 'split-squat' }, { exerciseId: 'push-up' }, { exerciseId: 'dumbbell-row' }, { exerciseId: 'single-leg-glute-bridge' }] },
      { label: 'Core', items: [{ exerciseId: 'side-plank' }, { exerciseId: 'hollow-hold' }] },
      { label: 'Finisher', items: [{ exerciseId: 'mountain-climber' }] },
      COOLDOWN,
    ],
  },
  {
    id: 'full-adv',
    name: 'Full Body — Peak',
    goals: ['allRoundStrength', 'runningFocus'],
    kind: 'fullBody',
    difficulty: 'advanced',
    durationMinutes: 30,
    runInterference: KIND_INTERFERENCE.fullBody,
    blocks: [
      WARMUP_LEGS,
      { label: 'Main', items: [{ exerciseId: 'bulgarian-split-squat' }, { exerciseId: 'diamond-push-up' }, { exerciseId: 'pull-up' }, { exerciseId: 'single-leg-glute-bridge' }] },
      { label: 'Core', items: [{ exerciseId: 'hollow-hold' }, { exerciseId: 'side-plank' }] },
      { label: 'Finisher', items: [{ exerciseId: 'mountain-climber' }] },
      COOLDOWN,
    ],
  },

  // ---- Core & Mobility (all three goals) — low interference recovery-style ----
  {
    id: 'core-mob-beg',
    name: 'Core & Mobility — Foundation',
    goals: ['runningFocus', 'allRoundStrength', 'upperBodyFocus'],
    kind: 'coreAndMobility',
    difficulty: 'beginner',
    durationMinutes: 30,
    runInterference: KIND_INTERFERENCE.coreAndMobility,
    blocks: [
      WARMUP_LEGS,
      { label: 'Main', items: [{ exerciseId: 'dead-bug' }, { exerciseId: 'bird-dog' }, { exerciseId: 'glute-bridge' }] },
      { label: 'Core', items: [{ exerciseId: 'plank' }] },
      { label: 'Finisher', items: [{ exerciseId: 'hollow-hold' }] },
      COOLDOWN,
    ],
  },
  {
    id: 'core-mob-int',
    name: 'Core & Mobility — Build',
    goals: ['runningFocus', 'allRoundStrength', 'upperBodyFocus'],
    kind: 'coreAndMobility',
    difficulty: 'intermediate',
    durationMinutes: 30,
    runInterference: KIND_INTERFERENCE.coreAndMobility,
    blocks: [
      WARMUP_LEGS,
      { label: 'Main', items: [{ exerciseId: 'dead-bug' }, { exerciseId: 'bird-dog' }, { exerciseId: 'single-leg-glute-bridge' }] },
      { label: 'Core', items: [{ exerciseId: 'side-plank' }, { exerciseId: 'hollow-hold' }] },
      { label: 'Finisher', items: [{ exerciseId: 'mountain-climber' }] },
      COOLDOWN,
    ],
  },
  {
    id: 'core-mob-adv',
    name: 'Core & Mobility — Peak',
    goals: ['runningFocus', 'allRoundStrength', 'upperBodyFocus'],
    kind: 'coreAndMobility',
    difficulty: 'advanced',
    durationMinutes: 30,
    runInterference: KIND_INTERFERENCE.coreAndMobility,
    blocks: [
      WARMUP_LEGS,
      { label: 'Main', items: [{ exerciseId: 'hollow-hold' }, { exerciseId: 'bird-dog' }, { exerciseId: 'single-leg-glute-bridge' }] },
      { label: 'Core', items: [{ exerciseId: 'side-plank' }, { exerciseId: 'mountain-climber' }] },
      { label: 'Finisher', items: [{ exerciseId: 'hollow-hold' }] },
      COOLDOWN,
    ],
  },
]
