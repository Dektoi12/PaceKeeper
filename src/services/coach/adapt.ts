import type { Run, Session, WorkoutStep } from '@/services/db/types'
import { isRunnableSession } from '@/services/stats/matching'
import type { PlanAdjustment } from './CoachEngine'

// Rule-based adaptive engine (spec §2.2). Pure: it reads last week's outcome +
// recent feel and proposes concrete edits to the upcoming week's sessions. The
// proposal is applied/undone by the actions layer so the UI can offer accept/undo.

export type AdaptationKind = 'reduce' | 'stepUp' | 'recovery'

export interface SessionPatch {
  id: string
  patch: Partial<Session>
}

export interface AdaptationProposal {
  kind: AdaptationKind
  offer: boolean // step-ups are offered, not auto-applied
  adjustment: PlanAdjustment
  changes: SessionPatch[]
  snapshot: SessionPatch[] // original values, for undo
}

export interface AdaptationContext {
  lastWeekSessions: Session[]
  upcomingSessions: Session[]
  recentRuns: Run[]
}

const QUALITY_TYPES: Session['type'][] = ['intervals', 'tempo', 'hills', 'fartlek']

const round1 = (n: number) => Math.round(n * 10) / 10

/** Snapshot only the keys a patch will change, so undo restores exactly them. */
function snapshotFor(session: Session, patch: Partial<Session>): SessionPatch {
  const original: Partial<Session> = {}
  for (const key of Object.keys(patch) as (keyof Session)[]) {
    ;(original as Record<string, unknown>)[key] = session[key]
  }
  return { id: session.id, patch: original }
}

function scaleDistance(sessions: Session[], factor: number): { changes: SessionPatch[]; snapshot: SessionPatch[] } {
  const changes: SessionPatch[] = []
  const snapshot: SessionPatch[] = []
  for (const s of sessions) {
    if (s.plannedDistanceKm == null) continue
    const patch: Partial<Session> = { plannedDistanceKm: round1(s.plannedDistanceKm * factor) }
    if (s.plannedDurationMin != null) patch.plannedDurationMin = Math.round(s.plannedDurationMin * factor)
    changes.push({ id: s.id, patch })
    snapshot.push(snapshotFor(s, patch))
  }
  return { changes, snapshot }
}

function avgFeel(lastWeekSessions: Session[], recentRuns: Run[]): number | undefined {
  const byId = new Map(recentRuns.map((r) => [r.id, r]))
  const feels: number[] = []
  for (const s of lastWeekSessions) {
    if (s.linkedRunId) {
      const feel = byId.get(s.linkedRunId)?.feel
      if (typeof feel === 'number') feels.push(feel)
    }
  }
  return feels.length ? feels.reduce((a, b) => a + b, 0) / feels.length : undefined
}

/**
 * Decide whether to adapt the upcoming week. Returns the single highest-priority
 * proposal (struggling → reduce → step-up), or null when the plan should hold.
 */
export function proposeAdaptation(ctx: AdaptationContext): AdaptationProposal | null {
  const plannedRunnable = ctx.lastWeekSessions.filter(isRunnableSession)
  const completed = plannedRunnable.filter((s) => s.status === 'completed')
  const missed = plannedRunnable.length - completed.length
  const feel = avgFeel(ctx.lastWeekSessions, ctx.recentRuns)

  const upcomingRunnable = ctx.upcomingSessions.filter(isRunnableSession)
  if (!upcomingRunnable.length) return null

  // 1) Struggling — recent runs felt hard. Add recovery, cut quality ~20%.
  if (feel != null && feel <= 2) {
    const changes: SessionPatch[] = []
    const snapshot: SessionPatch[] = []
    for (const s of upcomingRunnable) {
      if (QUALITY_TYPES.includes(s.type)) {
        const dist = s.plannedDistanceKm != null ? round1(s.plannedDistanceKm * 0.8) : undefined
        const steps: WorkoutStep[] = dist ? [{ kind: 'run', zone: 'Z2', distanceKm: dist, label: 'Easy' }] : []
        const patch: Partial<Session> = {
          type: 'easy',
          title: 'Recovery easy run',
          description: 'Softened from a quality session while you recover.',
          targetZone: 'Z2',
          targetPaceRange: undefined,
          plannedDistanceKm: dist,
          steps,
        }
        changes.push({ id: s.id, patch })
        snapshot.push(snapshotFor(s, patch))
      }
    }
    if (changes.length) {
      return {
        kind: 'recovery',
        offer: false,
        adjustment: {
          reason: 'Your recent runs have felt hard (average feel ≤ 2).',
          changedSessionIds: changes.map((c) => c.id),
          summary: `Eased ${changes.length} quality session${changes.length === 1 ? '' : 's'} to recovery to let your body absorb the work.`,
        },
        changes,
        snapshot,
      }
    }
  }

  // 2) Missed ≥ 2 sessions — reduce next week's volume ~15%.
  if (missed >= 2) {
    const { changes, snapshot } = scaleDistance(upcomingRunnable, 0.85)
    if (changes.length) {
      return {
        kind: 'reduce',
        offer: false,
        adjustment: {
          reason: `You missed ${missed} planned sessions last week.`,
          changedSessionIds: changes.map((c) => c.id),
          summary: 'Trimmed next week\'s volume by ~15% so you can rebuild consistency without digging a hole.',
        },
        changes,
        snapshot,
      }
    }
  }

  // 3) Crushed it — full completion and feeling strong. OFFER a step up ~5%.
  if (missed === 0 && plannedRunnable.length >= 2 && feel != null && feel >= 4) {
    const { changes, snapshot } = scaleDistance(upcomingRunnable, 1.05)
    if (changes.length) {
      return {
        kind: 'stepUp',
        offer: true,
        adjustment: {
          reason: 'You completed every session last week and felt strong.',
          changedSessionIds: changes.map((c) => c.id),
          summary: 'Ready to step up? This bumps next week\'s volume by ~5%. Accept to apply, or keep things as they are.',
        },
        changes,
        snapshot,
      }
    }
  }

  return null
}
