import type {
  Profile,
  Goal,
  Assessment,
  Plan,
  Session,
  SessionType,
  StrengthPreferences,
  WorkoutStep,
  PaceRange,
  PaceZones,
  Zone,
  GoalType,
} from '@/services/db/types'
import { uid } from '@/lib/id'
import { weekStart, addDays, toISO, todayISO, daysBetween } from '@/lib/dates'
import { paceZonesFromAssessment } from '@/services/zones'
import { strengthSteps, MOBILITY } from './exercises'
import { SESSION_META } from './sessionMeta'
import {
  strengthEngine,
  type DaySlot,
  type RunIntensity,
  type StrengthPlacement,
} from '@/services/strength'

// ---- Goal-level constants ----

const DEFAULT_WEEKS: Record<GoalType, number> = {
  '5k': 8,
  '10k': 10,
  half: 12,
  full: 16,
  ultra: 18,
  fitness: 8,
}

const LONG_PEAK_KM: Record<GoalType, number> = {
  '5k': 11,
  '10k': 15,
  half: 20,
  full: 32,
  ultra: 35,
  fitness: 12,
}

const START_VOLUME: Record<Profile['experience'], number> = {
  beginner: 15,
  intermediate: 28,
  advanced: 42,
}

type Phase = 'base' | 'build' | 'peak' | 'taper'

const round1 = (n: number) => Math.round(n * 10) / 10

// ---- Public API ----

export interface GenerateInput {
  profile: Profile
  goal: Goal
  assessment: Assessment
  weeksOverride?: number
  strength?: StrengthPreferences // when enabled, the strength engine places strength/mobility days
}

export interface GeneratedPlan {
  plan: Plan
  sessions: Session[]
}

export function generatePlan(input: GenerateInput): GeneratedPlan {
  const { profile, goal, assessment, strength } = input
  const zones = assessment.derivedPaceZones ?? paceZonesFromAssessment(assessment)
  const weeks = input.weeksOverride ?? resolveWeeks(goal)
  const runDays = clampRunDays(profile.preferredRunDays)
  const isFitness = goal.type === 'fitness'

  const planStart = weekStart(new Date()) // Monday of current week
  const planEnd = addDays(planStart, weeks * 7 - 1)

  const planId = uid()
  const volumes = weeklyVolumes(weeks, resolveStartVolume(profile, assessment), isFitness)

  const sessions: Session[] = []

  for (let w = 0; w < weeks; w++) {
    const weekNumber = w + 1
    const phase = phaseOf(weekNumber, weeks, isFitness)
    const weekMonday = addDays(planStart, w * 7)
    const weekly = volumes[w]

    // Ordered run weekdays present in this week (Mon→Sun), last one = long run.
    const orderedRunWeekdays = mondayFirstOrder(runDays)
    const roles = weeklyRoles(orderedRunWeekdays.length)

    // Allocate distance across roles.
    const longKm = longRunKm(goal.type, weekly, phase)
    const qualityKm = round1(weekly * 0.2)
    const qualityCount = roles.filter((r) => r === 'quality').length
    const easyCount = roles.filter((r) => r === 'easy').length
    const easyPool = Math.max(weekly - longKm - qualityKm * qualityCount, easyCount * 3)
    const easyKm = round1(easyPool / Math.max(easyCount, 1))

    // Classify each of the week's 7 days (Monday-first) with its run role/intensity.
    const dayInfos = Array.from({ length: 7 }, (_, dayIdx) => {
      const date = addDays(weekMonday, dayIdx)
      const iso = toISO(date)
      const dow = date.getDay() // 0=Sun … 6=Sat
      const runRoleIndex = orderedRunWeekdays.indexOf(dow)
      const role = runRoleIndex >= 0 ? roles[runRoleIndex] : undefined
      const runIntensity: RunIntensity | undefined =
        role === 'long' ? 'long' : role === 'quality' ? 'hard' : role === 'easy' ? 'easy' : undefined
      return { iso, dow, role, runIntensity }
    })

    // Strength placement (only when the feature is enabled). The engine owns all
    // strength/mobility days; remaining open days fall back to rest.
    const placementByDate = new Map<string, StrengthPlacement>()
    if (strength?.enabled) {
      const days: DaySlot[] = dayInfos.map((d) => ({ date: d.iso, run: d.runIntensity }))
      const scheduled = strengthEngine.scheduleWeek({ weekNumber, days, prefs: strength })
      for (const p of scheduled.placements) placementByDate.set(p.date, p)
    }

    // Legacy fixed strength/mobility days (feature-off behaviour, unchanged).
    const nonRunWeekdays = mondayFirstOrder([0, 1, 2, 3, 4, 5, 6]).filter((d) => !runDays.includes(d))
    const legacyStrengthDay = nonRunWeekdays[0]
    const legacyMobilityDay =
      nonRunWeekdays.length > 1 ? nonRunWeekdays[nonRunWeekdays.length - 1] : undefined

    let qualitySlot = 0

    for (const { iso, dow, role } of dayInfos) {
      let session: Session

      if (role === 'long') {
        session = buildRunSession('long', iso, weekNumber, dow, planId, zones, { distanceKm: longKm })
      } else if (role === 'quality') {
        const qType = qualityType(weekNumber, qualitySlot, phase, isFitness)
        qualitySlot++
        session = buildQualitySession(qType, iso, weekNumber, dow, planId, zones, qualityKm)
      } else if (role === 'easy') {
        session = buildRunSession('easy', iso, weekNumber, dow, planId, zones, { distanceKm: easyKm })
      } else if (strength?.enabled) {
        const placement = placementByDate.get(iso)
        session = placement
          ? buildPlacementSession(placement, weekNumber, dow, planId)
          : buildRestSession(iso, weekNumber, dow, planId)
      } else if (dow === legacyStrengthDay) {
        session = buildStrengthSession(iso, weekNumber, dow, planId, weekNumber % 2 === 0 ? 'B' : 'A')
      } else if (dow === legacyMobilityDay) {
        session = buildMobilitySession(iso, weekNumber, dow, planId)
      } else {
        session = buildRestSession(iso, weekNumber, dow, planId)
      }

      sessions.push(session)
    }
  }

  const plan: Plan = {
    id: planId,
    goalId: goal.id,
    engine: 'rule',
    startDate: toISO(planStart),
    endDate: toISO(planEnd),
    weeks,
    status: 'active',
    generatedAt: Date.now(),
  }

  return { plan, sessions }
}

// ---- Week / phase math ----

function resolveWeeks(goal: Goal): number {
  if (goal.type !== 'fitness' && goal.targetDate) {
    const d = daysBetween(todayISO(), goal.targetDate)
    if (d > 0) {
      const w = Math.ceil(d / 7)
      return Math.max(8, Math.min(20, w))
    }
  }
  return DEFAULT_WEEKS[goal.type]
}

function clampRunDays(days: number[]): number[] {
  const unique = Array.from(new Set(days)).filter((d) => d >= 0 && d <= 6)
  if (unique.length < 2) return [2, 4, 6] // sensible default Tue/Thu/Sat
  if (unique.length > 6) return unique.slice(0, 6)
  return unique
}

/** Sort weekday numbers into Monday-first order (Mon=1 … Sun=0 last). */
function mondayFirstOrder(days: number[]): number[] {
  const rank = (d: number) => (d === 0 ? 7 : d)
  return [...days].sort((a, b) => rank(a) - rank(b))
}

function phaseOf(weekNumber: number, weeks: number, isFitness: boolean): Phase {
  if (isFitness) return weekNumber % 4 === 0 ? 'base' : 'build'
  const taperWeeks = weeks >= 12 ? 2 : 1
  const peakWeeks = weeks >= 10 ? 2 : 1
  const baseWeeks = Math.max(2, Math.round(weeks * 0.35))
  if (weekNumber > weeks - taperWeeks) return 'taper'
  if (weekNumber > weeks - taperWeeks - peakWeeks) return 'peak'
  if (weekNumber <= baseWeeks) return 'base'
  return 'build'
}

function resolveStartVolume(profile: Profile, assessment: Assessment): number {
  if (assessment.method === 'weeklyMileage' && assessment.weeklyKm) {
    return Math.max(10, assessment.weeklyKm)
  }
  return START_VOLUME[profile.experience]
}

/** Weekly volumes with +8%/wk build, −25% cutback every 4th week, taper down. */
function weeklyVolumes(weeks: number, start: number, isFitness: boolean): number[] {
  const growth = 1.08
  const cap = start * 2.2
  const vols: number[] = []
  let running = start
  let lastFull = start

  for (let w = 1; w <= weeks; w++) {
    const phase = phaseOf(w, weeks, isFitness)
    if (phase === 'taper') {
      const taperWeeks = weeks >= 12 ? 2 : 1
      const idxIntoTaper = w - (weeks - taperWeeks) // 1..taperWeeks
      const factor = taperWeeks === 2 ? (idxIntoTaper === 1 ? 0.7 : 0.5) : 0.6
      vols.push(round1(lastFull * factor))
      continue
    }
    const isCutback = w % 4 === 0
    if (isCutback) {
      vols.push(round1(running * 0.75))
    } else {
      vols.push(round1(running))
      lastFull = running
      running = Math.min(running * growth, cap)
    }
  }
  return vols
}

function longRunKm(goal: GoalType, weekly: number, phase: Phase): number {
  const share = goal === '5k' || goal === 'fitness' ? 0.3 : 0.35
  const raw = weekly * share
  const peak = LONG_PEAK_KM[goal]
  const capped = Math.min(raw, peak)
  const taperCap = phase === 'taper' ? peak * 0.6 : peak
  return round1(Math.max(5, Math.min(capped, taperCap)))
}

// ---- Roles ----

type Role = 'easy' | 'quality' | 'long'

function weeklyRoles(runDayCount: number): Role[] {
  switch (runDayCount) {
    case 2:
      return ['easy', 'long']
    case 3:
      return ['easy', 'quality', 'long']
    case 4:
      return ['easy', 'quality', 'easy', 'long']
    case 5:
      return ['easy', 'quality', 'easy', 'quality', 'long']
    case 6:
      return ['easy', 'quality', 'easy', 'easy', 'quality', 'long']
    default:
      return ['easy', 'long']
  }
}

const QUALITY_ROTATION: SessionType[] = ['tempo', 'intervals', 'hills', 'fartlek']

function qualityType(
  weekNumber: number,
  slot: number,
  phase: Phase,
  isFitness: boolean,
): SessionType {
  if (isFitness) return slot === 0 ? 'tempo' : 'fartlek'
  if (phase === 'base') return slot === 0 ? 'tempo' : 'fartlek'
  if (phase === 'taper') return 'tempo'
  if (phase === 'peak') return slot === 0 ? 'intervals' : 'tempo'
  return QUALITY_ROTATION[(weekNumber + slot) % QUALITY_ROTATION.length]
}

// ---- Session builders ----

function paceForType(type: SessionType, zones: PaceZones): { pace?: PaceRange; zone: Zone } {
  switch (type) {
    case 'easy':
      return { pace: zones.easy, zone: 'Z2' }
    case 'long':
      return { pace: zones.easy, zone: 'Z2' }
    case 'tempo':
      return { pace: zones.threshold, zone: 'Z4' }
    case 'intervals':
      return { pace: zones.interval, zone: 'Z5' }
    case 'hills':
      return { pace: zones.repetition, zone: 'Z5' }
    case 'fartlek':
      return { pace: zones.threshold, zone: 'Z3' }
    default:
      return { zone: 'Z1' }
  }
}

function base(
  iso: string,
  weekNumber: number,
  dow: number,
  planId: string,
  type: SessionType,
): Pick<Session, 'id' | 'planId' | 'date' | 'weekNumber' | 'dayOfWeek' | 'type' | 'status'> {
  return {
    id: uid(),
    planId,
    date: iso,
    weekNumber,
    dayOfWeek: dow,
    type,
    status: 'upcoming',
  }
}

function buildRunSession(
  type: 'easy' | 'long',
  iso: string,
  weekNumber: number,
  dow: number,
  planId: string,
  zones: PaceZones,
  opts: { distanceKm: number },
): Session {
  const { pace, zone } = paceForType(type, zones)
  const steps: WorkoutStep[] = [
    { kind: 'run', distanceKm: opts.distanceKm, zone, targetPace: pace, label: SESSION_META[type].label },
  ]
  return {
    ...base(iso, weekNumber, dow, planId, type),
    title: type === 'long' ? `Long run — ${opts.distanceKm} km` : `Easy run — ${opts.distanceKm} km`,
    description: SESSION_META[type].why,
    steps,
    targetPaceRange: pace,
    targetZone: zone,
    plannedDistanceKm: opts.distanceKm,
  }
}

function buildQualitySession(
  type: SessionType,
  iso: string,
  weekNumber: number,
  dow: number,
  planId: string,
  zones: PaceZones,
  qualityKm: number,
): Session {
  const { pace, zone } = paceForType(type, zones)
  const warm: WorkoutStep = { kind: 'warmup', durationMin: 10, zone: 'Z2' }
  const cool: WorkoutStep = { kind: 'cooldown', durationMin: 10, zone: 'Z2' }
  let steps: WorkoutStep[]
  let title: string
  let planned = qualityKm + 3 // + warmup/cooldown estimate

  if (type === 'tempo') {
    steps = [warm, { kind: 'run', distanceKm: qualityKm, zone, targetPace: pace, label: 'Tempo' }, cool]
    title = `Tempo — ${qualityKm} km @ threshold`
  } else if (type === 'intervals') {
    const reps = Math.max(4, Math.round(qualityKm / 0.8))
    steps = [
      warm,
      {
        kind: 'repeat',
        times: reps,
        steps: [
          { kind: 'run', distanceKm: 0.8, zone, targetPace: pace, label: '800 m' },
          { kind: 'recover', durationMin: 1.5, mode: 'jog' },
        ],
      },
      cool,
    ]
    title = `Intervals — ${reps} × 800 m`
    planned = reps * 0.8 + 3
  } else if (type === 'hills') {
    const reps = Math.max(6, Math.round(qualityKm / 0.4))
    steps = [
      warm,
      {
        kind: 'repeat',
        times: reps,
        steps: [
          { kind: 'run', distanceKm: 0.4, zone, targetPace: pace, label: 'Hill' },
          { kind: 'recover', durationMin: 2, mode: 'jog' },
        ],
      },
      cool,
    ]
    title = `Hills — ${reps} × ~400 m`
    planned = reps * 0.4 + 3
  } else {
    // fartlek
    steps = [
      warm,
      {
        kind: 'repeat',
        times: 6,
        steps: [
          { kind: 'run', durationMin: 1, zone, targetPace: pace, label: 'Surge' },
          { kind: 'recover', durationMin: 2, mode: 'jog' },
        ],
      },
      cool,
    ]
    title = 'Fartlek — 6 × 1 min surges'
  }

  return {
    ...base(iso, weekNumber, dow, planId, type),
    title,
    description: SESSION_META[type].why,
    steps,
    targetPaceRange: pace,
    targetZone: zone,
    plannedDistanceKm: round1(planned),
  }
}

function buildStrengthSession(
  iso: string,
  weekNumber: number,
  dow: number,
  planId: string,
  variant: 'A' | 'B',
): Session {
  return {
    ...base(iso, weekNumber, dow, planId, 'strength'),
    title: `Runner's strength ${variant}`,
    description: SESSION_META.strength.why,
    steps: strengthSteps(variant),
    plannedDurationMin: 25,
  }
}

function buildPlacementSession(
  placement: StrengthPlacement,
  weekNumber: number,
  dow: number,
  planId: string,
): Session {
  return {
    ...base(placement.date, weekNumber, dow, planId, placement.sessionType),
    title: placement.title,
    description: SESSION_META[placement.sessionType].why,
    steps: placement.steps,
    plannedDurationMin: placement.durationMin,
    strength: {
      templateId: placement.templateId,
      kind: placement.kind,
      runInterference: placement.runInterference,
    },
  }
}

function buildMobilitySession(iso: string, weekNumber: number, dow: number, planId: string): Session {
  return {
    ...base(iso, weekNumber, dow, planId, 'mobility'),
    title: 'Mobility routine',
    description: SESSION_META.mobility.why,
    steps: MOBILITY,
    plannedDurationMin: 15,
  }
}

function buildRestSession(iso: string, weekNumber: number, dow: number, planId: string): Session {
  return {
    ...base(iso, weekNumber, dow, planId, 'rest'),
    title: 'Rest day',
    description: SESSION_META.rest.why,
    steps: [],
  }
}
