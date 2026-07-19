import { db, PROFILE_ID, getSettings } from './db'
import type {
  Profile,
  Goal,
  Assessment,
  Run,
  Session,
  SessionStatus,
  SessionType,
  Experience,
  Units,
  GoalType,
  Feel,
  AppSettings,
  StrengthPreferences,
} from './types'
import { uid } from '@/lib/id'
import { todayISO, weekDates, weekStartISO, addDays, fromISO } from '@/lib/dates'
import { vdotFromAssessment, paceZonesFromVdot } from '@/services/zones'
import { computeHRZones } from '@/services/zones'
import { generatePlan } from '@/services/planEngine'
import { generateFromTemplate, getTemplate, SESSION_META } from '@/services/planEngine'
import { strengthEngine, type DaySlot, type RunIntensity, type StrengthPlacement } from '@/services/strength'
import type { SkipReason, StrengthActivityLog, StrengthAdjustment } from './types'
import { findMatch, upsertRecords, evaluateBadges } from '@/services/stats'
import { coach } from '@/services/coach/RuleBasedCoach'
import { proposeAdaptation, type AdaptationProposal, type SessionPatch } from '@/services/coach/adapt'
import { buildWeekSummary, renderRecap } from '@/services/coach/recap'
import type { RecordKind, Recap, ChatMessage } from './types'

const round1 = (n: number) => Math.round(n * 10) / 10

// Dexie's typed `Table.update` UpdateSpec expands nested key paths, which loops
// forever on Session.steps (WorkoutStep.repeat is self-referential). Route
// session patches through Collection.modify, whose object form is untyped.
function patchSession(id: string, changes: Partial<Session>): Promise<number> {
  return db.sessions
    .where('id')
    .equals(id)
    .modify((obj) => {
      Object.assign(obj, changes)
    })
}

// ---- Onboarding ----

export interface OnboardingData {
  name: string
  age: number
  weightKg?: number
  units: Units
  experience: Experience
  maxHR?: number
  restingHR?: number
  preferredRunDays: number[]
  goalType: GoalType
  targetDate?: string
  targetTimeSec?: number
  assessmentMethod: Assessment['method']
  distanceKm?: number
  timeSec?: number
  weeklyKm?: number
  longestRecentKm?: number
  templateId?: string // if the user chose the "keep it simple" template path
}

export async function completeOnboarding(data: OnboardingData): Promise<{ planId: string }> {
  const now = Date.now()

  const profile: Profile = {
    id: PROFILE_ID,
    name: data.name,
    age: data.age,
    weightKg: data.weightKg,
    units: data.units,
    maxHR: data.maxHR,
    restingHR: data.restingHR,
    preferredRunDays: data.preferredRunDays,
    experience: data.experience,
    createdAt: now,
    updatedAt: now,
  }

  const goal: Goal = {
    id: uid(),
    type: data.goalType,
    targetDate: data.targetDate,
    targetTime: data.targetTimeSec,
    status: 'active',
    createdAt: now,
  }

  const assessment: Assessment = {
    id: uid(),
    date: todayISO(),
    method: data.assessmentMethod,
    distanceKm: data.distanceKm,
    timeSec: data.timeSec,
    weeklyKm: data.weeklyKm,
    longestRecentKm: data.longestRecentKm,
  }
  const vdot = vdotFromAssessment(assessment)
  assessment.derivedVdot = Math.round(vdot * 10) / 10
  assessment.derivedPaceZones = paceZonesFromVdot(vdot)
  assessment.derivedHRZones = computeHRZones(data.age, data.maxHR, data.restingHR)

  const strength = (await getSettings()).strength
  const template = data.templateId ? getTemplate(data.templateId) : undefined
  const generated = template
    ? generateFromTemplate(template, profile, goal, assessment, strength)
    : generatePlan({ profile, goal, assessment, strength })

  await db.transaction(
    'rw',
    db.profile,
    db.goals,
    db.assessments,
    db.plans,
    db.sessions,
    async () => {
      await db.profile.put(profile)
      await db.goals.put(goal)
      await db.assessments.put(assessment)
      await db.plans.put(generated.plan)
      await db.sessions.bulkPut(generated.sessions)
    },
  )

  return { planId: generated.plan.id }
}

export async function updateProfile(patch: Partial<Profile>): Promise<void> {
  await db.profile.update(PROFILE_ID, { ...patch, updatedAt: Date.now() })
}

/** Merge a patch into the app settings singleton (theme, coach engine, etc). */
export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings()
  const next = { ...current, ...patch }
  await db.settings.put(next)
  return next
}

/**
 * Rebuild the active plan from the current profile/goal/assessment. Existing
 * plan + its sessions are archived/removed; completed runs are untouched but
 * lose their session link. Used by Settings after profile changes.
 */
export async function regenerateActivePlan(): Promise<{ planId: string } | null> {
  const profile = await db.profile.get(PROFILE_ID)
  const goals = await db.goals.where('status').equals('active').toArray()
  const goal = goals[0]
  const assessments = await db.assessments.orderBy('date').toArray()
  const assessment = assessments[assessments.length - 1]
  if (!profile || !goal || !assessment) return null

  const activePlans = await db.plans.where('status').equals('active').toArray()
  const strength = (await getSettings()).strength
  const template = activePlans[0]?.templateId ? getTemplate(activePlans[0].templateId) : undefined
  const generated = template
    ? generateFromTemplate(template, profile, goal, assessment, strength)
    : generatePlan({ profile, goal, assessment, strength })

  await db.transaction('rw', db.plans, db.sessions, db.runs, async () => {
    for (const p of activePlans) {
      const oldSessions = await db.sessions.where('planId').equals(p.id).toArray()
      // Detach any runs linked to old sessions.
      for (const s of oldSessions) {
        if (s.linkedRunId) await db.runs.update(s.linkedRunId, { matchedSessionId: undefined })
      }
      await db.sessions.where('planId').equals(p.id).delete()
      await db.plans.delete(p.id)
    }
    await db.plans.put(generated.plan)
    await db.sessions.bulkPut(generated.sessions)
  })

  return { planId: generated.plan.id }
}

// ---- Strength preferences (STRENGTH_FEATURE_PLAN.md §9.6) ----

const RUNNABLE_TYPES = new Set<SessionType>(['easy', 'tempo', 'intervals', 'hills', 'fartlek', 'long'])
const HARD_RUN_TYPES = new Set<SessionType>(['tempo', 'intervals', 'hills', 'fartlek'])

function runIntensityOf(type: SessionType): RunIntensity | undefined {
  if (type === 'long') return 'long'
  if (type === 'easy') return 'easy'
  if (HARD_RUN_TYPES.has(type)) return 'hard'
  return undefined
}

function placementToSession(p: StrengthPlacement, weekNumber: number, planId: string): Session {
  return {
    id: uid(),
    planId,
    date: p.date,
    weekNumber,
    dayOfWeek: fromISO(p.date).getDay(),
    type: p.sessionType,
    title: p.title,
    description: SESSION_META[p.sessionType].why,
    steps: p.steps,
    plannedDurationMin: p.durationMin,
    status: 'upcoming',
    strength: { templateId: p.templateId, kind: p.kind, runInterference: p.runInterference },
  }
}

function restSession(date: string, weekNumber: number, planId: string): Session {
  return {
    id: uid(),
    planId,
    date,
    weekNumber,
    dayOfWeek: fromISO(date).getDay(),
    type: 'rest',
    title: 'Rest day',
    description: SESSION_META.rest.why,
    steps: [],
    status: 'upcoming',
  }
}

/**
 * Persist strength preferences and re-slot strength/mobility work for FUTURE
 * days only (date >= today, still upcoming). Runs, past sessions, and anything
 * already completed/skipped are left untouched. Disabling clears future strength
 * days back to rest while keeping all history.
 */
export async function applyStrengthPreferences(prefs: StrengthPreferences): Promise<void> {
  const updated: StrengthPreferences = { ...prefs, updatedAt: Date.now() }
  const settings = await updateSettings({ strength: updated })
  const strength = settings.strength
  const plan = await db.plans.where('status').equals('active').first()
  if (!plan || !strength) return

  const today = todayISO()
  const all = await db.sessions.where('planId').equals(plan.id).toArray()

  const byWeek = new Map<number, Session[]>()
  for (const s of all) {
    const arr = byWeek.get(s.weekNumber) ?? []
    arr.push(s)
    byWeek.set(s.weekNumber, arr)
  }

  const toDelete: string[] = []
  const toInsert: Session[] = []

  for (const [weekNumber, weekSessions] of byWeek) {
    // Reschedulable = upcoming, non-run, today-or-later open days.
    const reschedulable = weekSessions.filter(
      (s) => s.date >= today && s.status === 'upcoming' && !RUNNABLE_TYPES.has(s.type),
    )
    if (reschedulable.length === 0) continue

    const ordered = [...weekSessions].sort((a, b) => a.date.localeCompare(b.date))
    const days: DaySlot[] = ordered.map((s) => ({ date: s.date, run: runIntensityOf(s.type) }))

    const placementByDate = new Map<string, StrengthPlacement>()
    if (strength.enabled) {
      const scheduled = strengthEngine.scheduleWeek({ weekNumber, days, prefs: strength })
      for (const p of scheduled.placements) placementByDate.set(p.date, p)
    }

    for (const s of reschedulable) {
      toDelete.push(s.id)
      const placement = placementByDate.get(s.date)
      toInsert.push(
        placement
          ? placementToSession(placement, weekNumber, plan.id)
          : restSession(s.date, weekNumber, plan.id),
      )
    }
  }

  await db.transaction('rw', db.sessions, async () => {
    if (toDelete.length) await db.sessions.bulkDelete(toDelete)
    if (toInsert.length) await db.sessions.bulkPut(toInsert)
  })
}

// ---- Strength session player + logging (spec §4, §9.4-9.6) ----

/** Begin (or resume) a strength/mobility session — moves it to inProgress. */
export async function startStrengthSession(sessionId: string): Promise<void> {
  const s = await db.sessions.get(sessionId)
  if (!s) return
  await patchSession(sessionId, {
    status: 'inProgress',
    strengthLog: {
      startedAt: s.strengthLog?.startedAt ?? Date.now(),
      completedExerciseIds: s.strengthLog?.completedExerciseIds ?? [],
      perceivedEffort: s.strengthLog?.perceivedEffort,
      userNotes: s.strengthLog?.userNotes,
    },
  })
}

/** Persist which exercises the athlete has ticked off (resume support). */
export async function setStrengthProgress(sessionId: string, completedExerciseIds: string[]): Promise<void> {
  const s = await db.sessions.get(sessionId)
  if (!s) return
  await patchSession(sessionId, {
    strengthLog: {
      startedAt: s.strengthLog?.startedAt ?? Date.now(),
      completedExerciseIds,
      perceivedEffort: s.strengthLog?.perceivedEffort,
      userNotes: s.strengthLog?.userNotes,
    },
  })
}

/** Finish a strength/mobility session with perceived effort + optional note. */
export async function completeStrengthSession(
  sessionId: string,
  opts: { perceivedEffort?: 1 | 2 | 3 | 4 | 5; userNotes?: string; completedExerciseIds?: string[] } = {},
): Promise<void> {
  const s = await db.sessions.get(sessionId)
  if (!s) return
  await patchSession(sessionId, {
    status: 'completed',
    completedAt: Date.now(),
    strengthLog: {
      startedAt: s.strengthLog?.startedAt ?? Date.now(),
      completedExerciseIds: opts.completedExerciseIds ?? s.strengthLog?.completedExerciseIds ?? [],
      perceivedEffort: opts.perceivedEffort ?? s.strengthLog?.perceivedEffort,
      userNotes: opts.userNotes ?? s.strengthLog?.userNotes,
    },
  })
}

/**
 * Mark a run's warm-up or cool-down routine as done. The existing log is spread
 * so finishing one phase never clears the other.
 */
export async function completeRoutine(
  sessionId: string,
  phase: 'warmup' | 'cooldown',
): Promise<void> {
  const s = await db.sessions.get(sessionId)
  if (!s) return
  await patchSession(sessionId, {
    routineLog: {
      ...s.routineLog,
      [phase === 'warmup' ? 'warmupCompletedAt' : 'cooldownCompletedAt']: Date.now(),
    },
  })
}

/** Skip a session, recording the reason (feeds adaptivity §7). */
export async function skipSessionWithReason(sessionId: string, reason: SkipReason): Promise<void> {
  await patchSession(sessionId, { status: 'skipped', skipReason: reason })
}

/** Log an external/manual strength session (Runna parity, §4.5). */
export async function logStrengthActivity(input: {
  date: string
  durationMinutes: number
  label?: string
  notes?: string
}): Promise<StrengthActivityLog> {
  const log: StrengthActivityLog = {
    id: uid(),
    date: input.date,
    durationMinutes: input.durationMinutes,
    label: input.label,
    notes: input.notes,
    source: 'manual',
    createdAt: Date.now(),
  }
  await db.strengthActivityLog.put(log)
  return log
}

export async function deleteStrengthActivity(id: string): Promise<void> {
  await db.strengthActivityLog.delete(id)
}

/** The current adaptivity suggestion, or null (respects a prior dismissal). */
export async function getStrengthAdjustment(): Promise<StrengthAdjustment | null> {
  const settings = await getSettings()
  const prefs = settings.strength
  if (!prefs?.enabled) return null
  const sessions = await db.sessions.where('type').anyOf('strength', 'mobility').toArray()
  const suggestion = strengthEngine.suggestAdjustment(sessions, prefs)
  if (!suggestion) return null
  if (suggestion.signature === settings.strengthAdjustmentDismissed) return null
  return suggestion
}

/**
 * Accept a suggestion — apply its preference patch to future weeks. Also marks
 * this signature as handled so the same evidence window (e.g. the same 3
 * low-effort completions) doesn't immediately re-suggest another bump once the
 * preference change makes a further adjustment newly eligible.
 */
export async function applyStrengthAdjustment(adjustment: StrengthAdjustment): Promise<void> {
  const settings = await getSettings()
  const prefs = settings.strength
  if (!prefs) return
  await updateSettings({ strengthAdjustmentDismissed: adjustment.signature })
  await applyStrengthPreferences({ ...prefs, ...adjustment.patch })
}

export async function dismissStrengthAdjustment(signature: string): Promise<void> {
  await updateSettings({ strengthAdjustmentDismissed: signature })
}

export async function resetAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.profile, db.goals, db.assessments, db.plans, db.sessions, db.runs, db.records, db.achievements, db.recaps, db.chatMessages, db.settings, db.strengthActivityLog],
    async () => {
      await Promise.all([
        db.profile.clear(),
        db.goals.clear(),
        db.assessments.clear(),
        db.plans.clear(),
        db.sessions.clear(),
        db.runs.clear(),
        db.records.clear(),
        db.achievements.clear(),
        db.recaps.clear(),
        db.chatMessages.clear(),
        db.settings.clear(),
        db.strengthActivityLog.clear(),
      ])
    },
  )
}

// ---- Run logging (spec §4.2, §4.5) ----

export interface LogRunInput {
  date: string
  distanceKm: number
  durationSec: number
  feel?: Feel
  effortRPE?: number
  notes?: string
  source?: Run['source']
  attachSessionId?: string // explicit attach; if omitted, auto-match is attempted
  // Populated by file import (spec §4.3); all optional and stored as-is.
  splits?: Run['splits']
  avgHR?: number
  maxHR?: number
  elevationGainM?: number
  track?: string // polyline-encoded
  rawFileName?: string
}

export interface LogRunResult {
  run: Run
  matchedSession?: Session
  newPRs: RecordKind[]
  newBadges: string[] // badge ids unlocked by this run
}

export async function logRun(input: LogRunInput): Promise<LogRunResult> {
  const run: Run = {
    id: uid(),
    date: input.date,
    source: input.source ?? 'manual',
    distanceKm: input.distanceKm,
    durationSec: input.durationSec,
    avgPaceSecPerKm: input.distanceKm > 0 ? input.durationSec / input.distanceKm : 0,
    feel: input.feel,
    effortRPE: input.effortRPE,
    notes: input.notes,
    splits: input.splits,
    avgHR: input.avgHR,
    maxHR: input.maxHR,
    elevationGainM: input.elevationGainM,
    track: input.track,
    rawFileName: input.rawFileName,
    createdAt: Date.now(),
  }

  let matchedSession: Session | undefined

  await db.transaction('rw', db.runs, db.sessions, async () => {
    if (input.attachSessionId) {
      matchedSession = await db.sessions.get(input.attachSessionId)
    } else {
      const sameDay = await db.sessions.where('date').equals(input.date).toArray()
      const match = findMatch(run, sameDay)
      matchedSession = match?.session
    }

    if (matchedSession) {
      run.matchedSessionId = matchedSession.id
    }
    await db.runs.put(run)

    if (matchedSession) {
      await patchSession(matchedSession.id, {
        status: 'completed',
        linkedRunId: run.id,
        completedAt: Date.now(),
      })
      matchedSession = { ...matchedSession, status: 'completed', linkedRunId: run.id }
    }
  })

  // Recompute PRs + badges against the full history (now including this run).
  const allRuns = await db.runs.toArray()
  const newPRs = await upsertRecords(allRuns)
  const records = await db.records.toArray()
  const badges = await evaluateBadges(allRuns, records)

  return { run, matchedSession, newPRs, newBadges: badges.map((b) => b.id) }
}

export async function unlinkRun(runId: string): Promise<void> {
  await db.transaction('rw', db.runs, db.sessions, async () => {
    const run = await db.runs.get(runId)
    if (run?.matchedSessionId) {
      await patchSession(run.matchedSessionId, {
        status: 'upcoming',
        linkedRunId: undefined,
        completedAt: undefined,
      })
    }
    await db.runs.update(runId, { matchedSessionId: undefined })
  })
}

export async function deleteRun(runId: string): Promise<void> {
  await unlinkRun(runId)
  await db.runs.delete(runId)
}

// ---- Session editing (spec §2.6) ----

export async function setSessionStatus(sessionId: string, status: SessionStatus): Promise<void> {
  await patchSession(sessionId, { status })
}

export async function moveSession(sessionId: string, newDate: string): Promise<void> {
  const d = new Date(newDate)
  await patchSession(sessionId, { date: newDate, dayOfWeek: d.getDay(), status: 'moved' })
}

export async function swapSessions(aId: string, bId: string): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    const a = await db.sessions.get(aId)
    const b = await db.sessions.get(bId)
    if (!a || !b) return
    await patchSession(aId, { date: b.date, dayOfWeek: b.dayOfWeek })
    await patchSession(bId, { date: a.date, dayOfWeek: a.dayOfWeek })
  })
}

// ---- Coaching layer (spec §2.2, §2.4, §3) ----

/** Sessions (any status) and runs for the calendar week containing `ref`. */
async function weekData(ref: Date): Promise<{ sessions: Session[]; runs: Run[] }> {
  const days = weekDates(ref)
  const [sessions, runs] = await Promise.all([
    db.sessions.where('date').anyOf(days).toArray(),
    db.runs.where('date').anyOf(days).toArray(),
  ])
  return { sessions, runs }
}

/**
 * Generate (once) the recap for the week that just ended. Idempotent per
 * weekStart. Returns null when there's nothing to recap. Called on first
 * app-open of a new week.
 */
export async function generateWeeklyRecap(): Promise<Recap | null> {
  const prevWeekStart = weekStartISO(addDays(new Date(), -7))
  const existing = await db.recaps.where('weekStart').equals(prevWeekStart).first()
  if (existing) return existing

  const { sessions, runs } = await weekData(fromISO(prevWeekStart))
  if (!sessions.length && !runs.length) return null

  const summary = buildWeekSummary(prevWeekStart, sessions, runs)

  // Previous-previous week actual mileage, for the week-on-week comparison.
  const prevPrev = await weekData(addDays(fromISO(prevWeekStart), -7))
  const prevActualKm = round1(prevPrev.runs.reduce((s, r) => s + r.distanceKm, 0))

  // Focus line = the adaptation the engine would suggest for the current week.
  const current = await weekData(new Date())
  const upcoming = current.sessions.filter((s) => s.status === 'upcoming')
  const proposal = proposeAdaptation({
    lastWeekSessions: sessions,
    upcomingSessions: upcoming,
    recentRuns: runs,
  })

  const recapText = renderRecap(summary, { prevActualKm, focus: proposal?.adjustment.summary })
  const recap: Recap = { id: uid(), weekStart: prevWeekStart, summary, recapText, engine: 'rule' }
  await db.recaps.put(recap)
  return recap
}

/** Propose an adaptation to the current week based on last week's outcome. */
export async function proposeActivePlanAdjustment(): Promise<AdaptationProposal | null> {
  const lastWeek = await weekData(addDays(new Date(), -7))
  const current = await weekData(new Date())
  const upcoming = current.sessions.filter((s) => s.status === 'upcoming')
  return proposeAdaptation({
    lastWeekSessions: lastWeek.sessions,
    upcomingSessions: upcoming,
    recentRuns: lastWeek.runs,
  })
}

export async function applyPlanAdjustment(proposal: AdaptationProposal): Promise<void> {
  await db.transaction('rw', db.sessions, db.plans, async () => {
    for (const c of proposal.changes) await patchSession(c.id, c.patch)
    const active = await db.plans.where('status').equals('active').first()
    if (active) await db.plans.update(active.id, { lastAdaptedAt: Date.now() })
  })
}

export async function undoPlanAdjustment(snapshot: SessionPatch[]): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    for (const s of snapshot) await patchSession(s.id, s.patch)
  })
}

/** Persist a user chat message, generate the coach reply, and persist that too. */
export async function sendChatMessage(text: string): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed) return
  const now = Date.now()
  const userMsg: ChatMessage = { id: uid(), role: 'user', text: trimmed, createdAt: now }
  await db.chatMessages.put(userMsg)

  const [history, profile, current, recentRuns] = await Promise.all([
    db.chatMessages.orderBy('createdAt').toArray(),
    db.profile.get(PROFILE_ID),
    weekData(new Date()),
    db.runs.orderBy('date').reverse().limit(5).toArray(),
  ])

  const reply = await coach.chat(history, {
    profile,
    currentWeek: current.sessions,
    recentRuns,
  })
  const coachMsg: ChatMessage = { id: uid(), role: 'coach', text: reply, createdAt: Date.now() }
  await db.chatMessages.put(coachMsg)
}
