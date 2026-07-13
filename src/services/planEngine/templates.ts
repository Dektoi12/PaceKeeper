import type { GoalType, Profile, Goal, Assessment } from '@/services/db/types'
import { generatePlan, type GeneratedPlan } from './generator'

// Fixed templates (spec §2.3): the "keep it simple" path. Each is a preset that
// drives the deterministic generator with fixed parameters and is marked
// engine:'template' so the adaptive layer (later phase) leaves it alone.

export interface PlanTemplate {
  id: string
  name: string
  goalType: GoalType
  weeks: number
  runDays: number[] // default weekdays if the profile has none set
  description: string
}

export const TEMPLATES: PlanTemplate[] = [
  {
    id: 'couch-to-5k',
    name: 'Couch to 5K',
    goalType: '5k',
    weeks: 9,
    runDays: [1, 3, 5], // Mon/Wed/Fri
    description: 'Gentle beginner ramp to your first 5K over 9 weeks, 3 runs/week.',
  },
  {
    id: '10k-in-10',
    name: '10K in 10 weeks',
    goalType: '10k',
    weeks: 10,
    runDays: [2, 4, 6],
    description: 'Build to a strong 10K with one quality session and a growing long run.',
  },
  {
    id: 'half-12',
    name: 'Half marathon — 12 weeks',
    goalType: 'half',
    weeks: 12,
    runDays: [2, 4, 6, 0],
    description: 'Classic 12-week half build peaking around 20 km long runs.',
  },
  {
    id: 'base-6',
    name: 'Base building — 6 weeks',
    goalType: 'fitness',
    weeks: 6,
    runDays: [1, 3, 6],
    description: 'Six weeks of easy aerobic base with light strides — no racing.',
  },
]

export function getTemplate(id: string): PlanTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id)
}

export function generateFromTemplate(
  template: PlanTemplate,
  profile: Profile,
  goal: Goal,
  assessment: Assessment,
): GeneratedPlan {
  const effectiveProfile: Profile = {
    ...profile,
    preferredRunDays:
      profile.preferredRunDays?.length >= 2 ? profile.preferredRunDays : template.runDays,
  }
  const effectiveGoal: Goal = {
    ...goal,
    type: template.goalType,
    // Force template length by clearing target-date-driven sizing.
    targetDate: undefined,
  }
  const result = generatePlan({
    profile: effectiveProfile,
    goal: effectiveGoal,
    assessment,
    weeksOverride: template.weeks,
  })
  result.plan.engine = 'template'
  result.plan.templateId = template.id
  // Re-key sessions to the (already correct) plan id — generatePlan handled it.
  return result
}
