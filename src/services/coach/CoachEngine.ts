import type {
  Profile,
  Goal,
  Assessment,
  Plan,
  Session,
  Run,
  WeekSummary,
  ChatMessage,
} from '@/services/db/types'
import type { GeneratedPlan } from '@/services/planEngine'

// AI abstraction (spec §3.1). Only this module will ever touch a network
// endpoint. RuleBasedCoach ships now; ClaudeCoach implements the same interface
// later without any other change to the app.

export interface Compliance {
  plannedSessions: number
  completedSessions: number
}

export interface PlanAdjustment {
  reason: string
  changedSessionIds: string[]
  summary: string
}

export interface CoachContext {
  profile?: Profile
  currentWeek?: Session[]
  recentRuns?: Run[]
}

export interface CoachEngine {
  generatePlan(profile: Profile, goal: Goal, assessment: Assessment): Promise<GeneratedPlan>
  adaptPlan(plan: Plan, recentRuns: Run[], compliance: Compliance): Promise<PlanAdjustment>
  weeklyRecap(week: WeekSummary): Promise<string>
  chat(history: ChatMessage[], context: CoachContext): Promise<string>
}
