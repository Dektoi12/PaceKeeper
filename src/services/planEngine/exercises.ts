import type { WorkoutStep } from '@/services/db/types'

// Runner's strength A/B + mobility (spec §2.7). Bodyweight, calisthenics level.

export const STRENGTH_A: WorkoutStep[] = [
  { kind: 'exercise', name: 'Bodyweight squats', sets: 3, reps: '15' },
  { kind: 'exercise', name: 'Walking lunges', sets: 3, reps: '10 / leg' },
  { kind: 'exercise', name: 'Calf raises', sets: 3, reps: '20' },
  { kind: 'exercise', name: 'Glute bridges', sets: 3, reps: '15' },
  { kind: 'exercise', name: 'Plank', sets: 3, reps: '45s' },
  { kind: 'exercise', name: 'Side plank', sets: 2, reps: '30s / side' },
  { kind: 'exercise', name: 'Push-ups', sets: 3, reps: '12' },
  { kind: 'exercise', name: 'Superman hold', sets: 3, reps: '30s' },
]

export const STRENGTH_B: WorkoutStep[] = [
  { kind: 'exercise', name: 'Single-leg deadlift', sets: 3, reps: '10 / leg' },
  { kind: 'exercise', name: 'Step-ups', sets: 3, reps: '12 / leg' },
  { kind: 'exercise', name: 'Bulgarian split squat', sets: 3, reps: '10 / leg' },
  { kind: 'exercise', name: 'Single-leg calf raise', sets: 3, reps: '12 / leg' },
  { kind: 'exercise', name: 'Hollow hold', sets: 3, reps: '30s' },
  { kind: 'exercise', name: 'Dead bug', sets: 3, reps: '10 / side' },
  { kind: 'exercise', name: 'Clamshells', sets: 3, reps: '15 / side' },
  { kind: 'exercise', name: 'Mountain climbers', sets: 3, reps: '30s' },
]

export const MOBILITY: WorkoutStep[] = [
  { kind: 'exercise', name: 'Hip flexor stretch', sets: 1, reps: '45s / side' },
  { kind: 'exercise', name: 'Downward dog to cobra', sets: 1, reps: '8 flows' },
  { kind: 'exercise', name: 'World’s greatest stretch', sets: 1, reps: '5 / side' },
  { kind: 'exercise', name: 'Ankle circles', sets: 1, reps: '10 / dir / side' },
  { kind: 'exercise', name: 'Standing quad stretch', sets: 1, reps: '45s / side' },
  { kind: 'exercise', name: 'Figure-4 glute stretch', sets: 1, reps: '45s / side' },
  { kind: 'exercise', name: 'Calf + hamstring stretch', sets: 1, reps: '45s / side' },
  { kind: 'exercise', name: 'Thoracic rotations', sets: 1, reps: '8 / side' },
]

export function strengthSteps(variant: 'A' | 'B'): WorkoutStep[] {
  return variant === 'A' ? STRENGTH_A : STRENGTH_B
}
