import type { Profile, Goal, Assessment, Plan, Run, WeekSummary, ChatMessage } from '@/services/db/types'
import { generatePlan, type GeneratedPlan } from '@/services/planEngine'
import type { CoachEngine, Compliance, PlanAdjustment, CoachContext } from './CoachEngine'
import { renderRecap } from './recap'
import { answerFaq } from './faq'

// v1 coach: fully offline and deterministic. Plan generation, weekly recaps,
// rule-based adaptation, and a curated FAQ chat all run on-device. ClaudeCoach
// implements the same interface later for networked, personalised coaching.
export class RuleBasedCoach implements CoachEngine {
  async generatePlan(profile: Profile, goal: Goal, assessment: Assessment): Promise<GeneratedPlan> {
    return generatePlan({ profile, goal, assessment })
  }

  // The concrete session edits are computed by proposeAdaptation (see ./adapt)
  // and applied through the actions layer; here we surface the decision. This
  // is a light wrapper so the CoachEngine contract stays uniform for the AI coach.
  async adaptPlan(_plan: Plan, _recentRuns: Run[], compliance: Compliance): Promise<PlanAdjustment> {
    const missed = compliance.plannedSessions - compliance.completedSessions
    if (missed >= 2) {
      return {
        reason: `You missed ${missed} planned sessions.`,
        changedSessionIds: [],
        summary: 'Consider easing next week to rebuild consistency.',
      }
    }
    if (compliance.plannedSessions > 0 && missed === 0) {
      return {
        reason: 'You completed every planned session.',
        changedSessionIds: [],
        summary: 'Strong week — you may be ready to step up the volume.',
      }
    }
    return { reason: 'Plan is on track.', changedSessionIds: [], summary: 'Keep going as planned.' }
  }

  async weeklyRecap(week: WeekSummary): Promise<string> {
    return renderRecap(week)
  }

  async chat(history: ChatMessage[], _context: CoachContext): Promise<string> {
    const lastUser = [...history].reverse().find((m) => m.role === 'user')
    if (!lastUser) return 'Ask me anything about your training — easy pace, intervals, long runs, tapering…'
    return answerFaq(lastUser.text)
  }
}

export const coach: CoachEngine = new RuleBasedCoach()
