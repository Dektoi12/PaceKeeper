import type { Profile, Goal, Assessment, Plan, Run, WeekSummary, ChatMessage } from '@/services/db/types'
import { generatePlan, type GeneratedPlan } from '@/services/planEngine'
import type { CoachEngine, Compliance, PlanAdjustment, CoachContext } from './CoachEngine'

const NOT_IN_BUILD = 'This capability arrives in a later build. (Offline coach mode)'

// v1 coach: plan generation is real & deterministic; adapt/recap/chat are stubs
// that keep the abstraction intact for the Phase 6 / Claude work without
// shipping dead UI now.
export class RuleBasedCoach implements CoachEngine {
  async generatePlan(profile: Profile, goal: Goal, assessment: Assessment): Promise<GeneratedPlan> {
    return generatePlan({ profile, goal, assessment })
  }

  async adaptPlan(_plan: Plan, _recentRuns: Run[], _compliance: Compliance): Promise<PlanAdjustment> {
    throw new Error(NOT_IN_BUILD)
  }

  async weeklyRecap(_week: WeekSummary): Promise<string> {
    throw new Error(NOT_IN_BUILD)
  }

  async chat(_history: ChatMessage[], _context: CoachContext): Promise<string> {
    throw new Error(NOT_IN_BUILD)
  }
}

export const coach: CoachEngine = new RuleBasedCoach()
