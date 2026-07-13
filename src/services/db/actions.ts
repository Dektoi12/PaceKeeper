import { db, PROFILE_ID } from './db'
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
} from './types'
import { uid } from '@/lib/id'
import { todayISO } from '@/lib/dates'
import { vdotFromAssessment, paceZonesFromVdot } from '@/services/zones'
import { computeHRZones } from '@/services/zones'
import { generatePlan } from '@/services/planEngine'
import { generateFromTemplate, getTemplate } from '@/services/planEngine'
import { findMatch } from '@/services/stats'

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
}

export interface LogRunResult {
  run: Run
  matchedSession?: Session
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

  return { run, matchedSession }
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
