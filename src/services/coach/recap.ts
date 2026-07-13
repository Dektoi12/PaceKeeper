import type { Feel, Run, Session, Split, WeekSummary } from '@/services/db/types'
import { isRunnableSession } from '@/services/stats/matching'

// Weekly recap generation (spec §2.4). Pure helpers: build the numeric summary
// and render rule-templated prose. The DB orchestration (which week, dedupe,
// persistence) lives in the actions layer.

export function buildWeekSummary(weekStart: string, sessions: Session[], runs: Run[]): WeekSummary {
  const runnable = sessions.filter(isRunnableSession)
  const completed = runnable.filter((s) => s.status === 'completed')
  const plannedKm = sessions.reduce((sum, s) => sum + (s.plannedDistanceKm ?? 0), 0)
  const actualKm = runs.reduce((sum, r) => sum + r.distanceKm, 0)
  const feels = runs.map((r) => r.feel).filter((f): f is Feel => f != null)
  return {
    weekStart,
    plannedSessions: runnable.length,
    completedSessions: completed.length,
    plannedKm: Math.round(plannedKm * 10) / 10,
    actualKm: Math.round(actualKm * 10) / 10,
    avgFeel: feels.length ? Math.round((feels.reduce((a, b) => a + b, 0) / feels.length) * 10) / 10 : undefined,
  }
}

export function bestSplit(runs: Run[]): { split: Split; runId: string } | undefined {
  let best: { split: Split; runId: string } | undefined
  for (const r of runs) {
    for (const s of r.splits ?? []) {
      if (s.paceSecPerKm > 0 && (!best || s.paceSecPerKm < best.split.paceSecPerKm)) {
        best = { split: s, runId: r.id }
      }
    }
  }
  return best
}

export interface RecapRenderOptions {
  prevActualKm?: number
  focus?: string // the adaptation decision / focus for next week
}

const feelWord = (f?: number): string => {
  if (f == null) return 'mixed'
  if (f >= 4.5) return 'excellent'
  if (f >= 3.5) return 'strong'
  if (f >= 2.5) return 'steady'
  if (f >= 1.5) return 'tough'
  return 'very tough'
}

/** Rule-templated recap prose from a week summary. */
export function renderRecap(summary: WeekSummary, opts: RecapRenderOptions = {}): string {
  const lines: string[] = []

  // Sessions.
  if (summary.plannedSessions > 0) {
    const ratio = `${summary.completedSessions}/${summary.plannedSessions}`
    if (summary.completedSessions >= summary.plannedSessions) {
      lines.push(`You completed every planned session (${ratio}) — excellent consistency.`)
    } else if (summary.completedSessions === 0) {
      lines.push(`No planned sessions logged this week (${ratio}). No guilt — let's reset and go again.`)
    } else {
      lines.push(`You logged ${ratio} planned sessions.`)
    }
  } else {
    lines.push('No structured sessions were scheduled this week.')
  }

  // Mileage vs plan / last week.
  const mileageBits: string[] = [`${summary.actualKm} km run`]
  if (summary.plannedKm > 0) mileageBits.push(`of ${summary.plannedKm} km planned`)
  lines.push(mileageBits.join(' '))
  if (opts.prevActualKm != null) {
    const delta = Math.round((summary.actualKm - opts.prevActualKm) * 10) / 10
    if (Math.abs(delta) >= 0.5) {
      lines.push(
        delta > 0
          ? `That's ${delta} km more than last week — building nicely.`
          : `That's ${Math.abs(delta)} km less than last week.`,
      )
    }
  }

  // Feel.
  if (summary.avgFeel != null) {
    lines.push(`Runs felt ${feelWord(summary.avgFeel)} on average (${summary.avgFeel}/5).`)
  }

  // Focus / adaptation.
  if (opts.focus) lines.push(`Focus for next week: ${opts.focus}`)

  return lines.join(' ')
}
