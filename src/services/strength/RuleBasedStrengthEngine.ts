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
}

export const strengthEngine: StrengthEngine = new RuleBasedStrengthEngine()
