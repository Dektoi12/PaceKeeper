import type { Experience, Session, StrengthAdjustment, StrengthPreferences } from '@/services/db/types'
import { resolveSession } from './resolve'
import { weeklyKinds } from './rotation'
import { scheduleStrengthWeek } from './scheduler'
import { STRENGTH_TEMPLATES } from './templates'
import { KIND_INTERFERENCE } from './types'
import type {
  ScheduleWeekInput,
  ScheduleWeekResult,
  StrengthEngine,
  StrengthPlacement,
} from './StrengthEngine'

const HARDER: Record<Experience, Experience | null> = {
  beginner: 'intermediate',
  intermediate: 'advanced',
  advanced: null,
}
const EASIER: Record<Experience, Experience | null> = {
  beginner: null,
  intermediate: 'beginner',
  advanced: 'intermediate',
}

const LEVEL_LABEL: Record<Experience, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

class RuleBasedStrengthEngine implements StrengthEngine {
  scheduleWeek({ weekNumber, days, prefs }: ScheduleWeekInput): ScheduleWeekResult {
    const kinds = weeklyKinds(prefs.goal, prefs.frequencyPerWeek, weekNumber)
    const { placements: slots, dropped } = scheduleStrengthWeek(days, kinds)

    const placements: StrengthPlacement[] = []
    for (const slot of slots) {
      const resolved = resolveSession(
        STRENGTH_TEMPLATES,
        slot.kind,
        prefs.experienceLevel,
        prefs.sessionLengthMinutes,
        prefs.equipment,
      )
      if (!resolved) continue
      placements.push({
        date: slot.date,
        sessionType: slot.kind === 'coreAndMobility' ? 'mobility' : 'strength',
        kind: slot.kind,
        templateId: resolved.template.id,
        title: resolved.template.name,
        steps: resolved.steps,
        durationMin: resolved.durationMin,
        runInterference: KIND_INTERFERENCE[slot.kind],
      })
    }

    return { placements, droppedCount: dropped.length }
  }

  suggestAdjustment(sessions: Session[], prefs: StrengthPreferences): StrengthAdjustment | null {
    if (!prefs.enabled) return null

    // Terminal (completed/skipped) strength/mobility sessions, oldest → newest.
    const terminal = sessions
      .filter((s) => s.strength && (s.status === 'completed' || s.status === 'skipped'))
      .sort((a, b) => a.date.localeCompare(b.date))
    if (terminal.length === 0) return null

    // 1) Skip-streak → offer to reduce frequency (spec §7 adaptivity).
    let trailingSkips = 0
    for (let i = terminal.length - 1; i >= 0 && terminal[i].status === 'skipped'; i--) trailingSkips++
    if (trailingSkips >= 2 && prefs.frequencyPerWeek > 1) {
      const next = (prefs.frequencyPerWeek - 1) as 1 | 2 | 3
      return {
        kind: 'reduceFrequency',
        signature: `reduceFrequency:${terminal[terminal.length - 1].id}`,
        title: 'Ease off strength?',
        detail: `You've skipped your last ${trailingSkips} strength sessions. Drop to ${next}×/week to keep it sustainable?`,
        patch: { frequencyPerWeek: next },
      }
    }

    // 2) Effort-based difficulty nudge over the last 3 completions.
    const completed = terminal.filter(
      (s) => s.status === 'completed' && s.strengthLog?.perceivedEffort != null,
    )
    const last3 = completed.slice(-3)
    if (last3.length === 3) {
      const efforts = last3.map((s) => s.strengthLog!.perceivedEffort!)
      const sig = last3[last3.length - 1].id
      if (efforts.every((e) => e <= 2) && HARDER[prefs.experienceLevel]) {
        const level = HARDER[prefs.experienceLevel]!
        return {
          kind: 'increaseDifficulty',
          signature: `increaseDifficulty:${sig}`,
          title: 'Ready to level up?',
          detail: `Your last 3 sessions felt easy. Try ${LEVEL_LABEL[level]} exercises for more challenge?`,
          patch: { experienceLevel: level },
        }
      }
      if (efforts.every((e) => e >= 5) && EASIER[prefs.experienceLevel]) {
        const level = EASIER[prefs.experienceLevel]!
        return {
          kind: 'decreaseDifficulty',
          signature: `decreaseDifficulty:${sig}`,
          title: 'Dial it back?',
          detail: `Your last 3 sessions felt very hard. Ease down to ${LEVEL_LABEL[level]} exercises?`,
          patch: { experienceLevel: level },
        }
      }
    }

    return null
  }
}

export const strengthEngine: StrengthEngine = new RuleBasedStrengthEngine()
