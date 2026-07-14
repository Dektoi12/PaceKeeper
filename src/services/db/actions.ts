import { db, PROFILE_ID, getSettings } from './db'
import type {
  Profile,
  Goal,
  Assessment,
  Run,
  Session,
  SessionStatus,
  Experience,
  Units,
  GoalType,
  Feel,
  AppSettings,
} from './types'
import { uid } from '@/lib/id'
import { todayISO, weekDates, weekStartISO, addDays, fromISO } from '@/lib/dates'
import { vdotFromAssessment, vdotFromRace, paceZonesFromVdot } from '@/services/zones'
import { computeHRZones } from '@/services/zones'
import { generatePlan } from '@/services/planEngine'
import { generateFromTemplate, getTemplate, SESSION_META } from '@/services/planEngine'
import { findMatch, upsertRecords, evaluateBadges } from '@/services/stats'
import { coach } from '@/services/coach/RuleBasedCoach'
import { proposeAdaptation, type AdaptationProposal, type SessionPatch } from '@/services/coach/adapt'
import { buildWeekSummary, renderRecap } from '@/services/coach/recap'
import type { PRRecord, RecordKind, Recap, ChatMessage } from './types'

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

  const template = data.templateId ? getTemplate(data.templateId) : undefined
  const generated = template
    ? generateFromTemplate(template, profile, goal, assessment)
    : generatePlan({ profile, goal, assessment })

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

/**
 * One-time cleanup for the removed strength/mobility feature. Older plans may
 * still hold non-running sessions on-device whose type is no longer valid;
 * convert them to rest days so they render correctly. No-op once none remain.
 * Runs at startup (main.tsx).
 */
export async function migrateRemoveStrengthSessions(): Promise<number> {
  let count = 0
  await db.sessions
    // Cast: 'strength'/'mobility' are no longer in SessionType, but legacy rows can still carry them.
    .filter((s) => (s.type as string) === 'strength' || (s.type as string) === 'mobility')
    .modify((s) => {
      s.type = 'rest'
      s.title = 'Rest day'
      s.description = SESSION_META.rest.why
      s.steps = []
      s.plannedDistanceKm = undefined
      s.plannedDurationMin = undefined
      s.targetPaceRange = undefined
      s.targetZone = undefined
      count++
    })
  return count
}

/**
 * Update profile fields and, when the HR inputs (age / max HR / resting HR)
 * change, recompute the HR zones stored on the latest assessment so the
 * reference zones shown around the app stay in sync. Used by the profile
 * editor. Pace zones are unaffected — they derive from the fitness
 * assessment, not from these fields.
 */
export async function updateProfileAndZones(patch: Partial<Profile>): Promise<void> {
  await db.transaction('rw', db.profile, db.assessments, async () => {
    const current = await db.profile.get(PROFILE_ID)
    if (!current) return
    const next: Profile = { ...current, ...patch, updatedAt: Date.now() }
    await db.profile.put(next)

    const assessments = await db.assessments.orderBy('date').toArray()
    const latest = assessments[assessments.length - 1]
    if (latest) {
      const zones = computeHRZones(next.age, next.maxHR, next.restingHR)
      await db.assessments.update(latest.id, { derivedHRZones: zones })
    }
  })
}

/**
 * Update the weekly-mileage baseline on the latest assessment. This figure is
 * the plan's PEAK weekly volume — the plan starts lower (scaled to fitness
 * level) and builds up to it. Regenerate the active plan afterward to apply it.
 * Training paces (VDOT/pace zones) are intentionally left as-is.
 */
export async function updateWeeklyMileage(input: {
  weeklyKm: number
  longestRecentKm?: number
}): Promise<boolean> {
  const assessments = await db.assessments.orderBy('date').toArray()
  const latest = assessments[assessments.length - 1]
  if (!latest) return false
  await db.assessments.update(latest.id, {
    weeklyKm: input.weeklyKm,
    longestRecentKm: input.longestRecentKm,
  })
  return true
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
  const template = activePlans[0]?.templateId ? getTemplate(activePlans[0].templateId) : undefined
  const generated = template
    ? generateFromTemplate(template, profile, goal, assessment)
    : generatePlan({ profile, goal, assessment })

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

export async function resetAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.profile, db.goals, db.assessments, db.plans, db.sessions, db.runs, db.records, db.achievements, db.recaps, db.chatMessages, db.settings],
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
      ])
    },
  )
}

// ---- Personal records (spec §5) ----

// Race-distance records whose value (normalized time) reflects fitness and can
// drive training paces. The rest (longest run, biggest week, streak) don't.
const RECORD_RACE_KM: Partial<Record<RecordKind, number>> = {
  fastest5k: 5,
  fastest10k: 10,
  fastestHalf: 21.0975,
  fastestFull: 42.195,
}

/**
 * Set or override a personal record by hand. The value is stored as a manual
 * record (sticky — auto-tracking won't overwrite it unless a real run beats it).
 * For a race-distance PB this also re-derives VDOT + pace zones from the effort
 * and regenerates the active plan, so training paces track your fitness.
 * Returns whether the plan was regenerated.
 */
export async function setPersonalRecord(
  kind: RecordKind,
  value: number,
): Promise<{ planRegenerated: boolean }> {
  await db.transaction('rw', db.records, async () => {
    const existing = await db.records.where('kind').equals(kind).first()
    const record: PRRecord = {
      id: existing?.id ?? uid(),
      kind,
      value,
      runId: undefined, // manual entry isn't tied to a logged run
      achievedAt: Date.now(),
      manual: true,
    }
    await db.records.put(record)
  })

  const km = RECORD_RACE_KM[kind]
  if (km && value > 0 && (await applyFitnessFromRace(km, value))) {
    const res = await regenerateActivePlan()
    return { planRegenerated: res != null }
  }
  return { planRegenerated: false }
}

/** Remove a record. A run-derived record will simply recompute on your next
 *  log; a manual override is cleared for good. */
export async function clearPersonalRecord(kind: RecordKind): Promise<void> {
  const existing = await db.records.where('kind').equals(kind).first()
  if (existing) await db.records.delete(existing.id)
}

/** Re-derive VDOT + pace zones from a race effort onto the latest assessment,
 *  preserving the weekly-mileage baseline. Returns false if none exists yet. */
async function applyFitnessFromRace(distanceKm: number, timeSec: number): Promise<boolean> {
  const assessments = await db.assessments.orderBy('date').toArray()
  const latest = assessments[assessments.length - 1]
  if (!latest) return false
  const vdot = vdotFromRace(distanceKm, timeSec)
  if (vdot <= 0) return false
  await db.assessments.update(latest.id, {
    method: 'recentRace',
    distanceKm,
    timeSec,
    derivedVdot: Math.round(vdot * 10) / 10,
    derivedPaceZones: paceZonesFromVdot(vdot),
  })
  return true
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
