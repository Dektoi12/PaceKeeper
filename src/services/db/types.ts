// Domain types for PaceKeeper (spec §4). Full schema defined up-front so later
// phases (import, stats, coach) add data without a schema migration.

export type Units = 'km' | 'mi'
export type Experience = 'beginner' | 'intermediate' | 'advanced'

export type GoalType = '5k' | '10k' | 'half' | 'full' | 'ultra' | 'fitness'
export type GoalStatus = 'active' | 'done' | 'abandoned'

export type SessionType =
  | 'easy'
  | 'tempo'
  | 'intervals'
  | 'hills'
  | 'fartlek'
  | 'long'
  | 'strength'
  | 'mobility'
  | 'rest'

export type SessionStatus = 'upcoming' | 'completed' | 'skipped' | 'moved'
export type PlanEngine = 'rule' | 'ai' | 'template'
export type PlanStatus = 'active' | 'completed' | 'archived'
export type RunSource = 'manual' | 'gpx' | 'tcx' | 'fit'

export type Zone = 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5'
export type Feel = 1 | 2 | 3 | 4 | 5

// Pace stored as seconds-per-km internally; formatting handles unit display.
export interface PaceRange {
  minSecPerKm: number
  maxSecPerKm: number
}

// VDOT-derived training paces (spec §1.4)
export interface PaceZones {
  easy: PaceRange
  marathon: PaceRange
  threshold: PaceRange
  interval: PaceRange
  repetition: PaceRange
}

export interface HRZone {
  zone: Zone
  minBpm: number
  maxBpm: number
}

export interface HRZones {
  maxHR: number
  restingHR?: number
  method: 'nes' | 'karvonen'
  zones: HRZone[]
}

// --- Structured workout steps (spec §6.3.3) ---
export type WorkoutStep =
  | { kind: 'warmup' | 'cooldown'; durationMin: number; zone: Zone }
  | {
      kind: 'run'
      distanceKm?: number
      durationMin?: number
      targetPace?: PaceRange
      zone: Zone
      label?: string
    }
  | { kind: 'recover'; durationMin: number; mode: 'jog' | 'walk' | 'rest' }
  | { kind: 'repeat'; times: number; steps: WorkoutStep[] }
  | { kind: 'exercise'; name: string; sets: number; reps: string } // strength/mobility

export interface Split {
  index: number // 1-based km or mi
  distanceKm: number
  durationSec: number
  paceSecPerKm: number
  avgHR?: number
}

export interface LatLng {
  lat: number
  lng: number
  ele?: number
}

// --- Tables ---

export interface Profile {
  id: string // singleton: 'me'
  name: string
  age: number
  weightKg?: number
  units: Units
  maxHR?: number
  restingHR?: number
  preferredRunDays: number[] // 0=Sun … 6=Sat
  experience: Experience
  createdAt: number
  updatedAt: number
}

export interface Goal {
  id: string
  type: GoalType
  targetDate?: string // ISO date
  targetTime?: number // seconds
  status: GoalStatus
  createdAt: number
}

export interface Assessment {
  id: string
  date: string
  method: 'recentRace' | 'weeklyMileage' | 'benchmarkRun'
  distanceKm?: number
  timeSec?: number
  weeklyKm?: number
  longestRecentKm?: number
  notes?: string
  derivedVdot?: number
  derivedPaceZones?: PaceZones
  derivedHRZones?: HRZones
}

export interface Plan {
  id: string
  goalId: string
  engine: PlanEngine
  templateId?: string
  startDate: string
  endDate: string
  weeks: number
  status: PlanStatus
  generatedAt: number
  lastAdaptedAt?: number
}

export interface Session {
  id: string
  planId: string
  date: string // ISO date (yyyy-MM-dd)
  weekNumber: number
  dayOfWeek: number // 0–6
  type: SessionType
  title: string
  description: string
  steps: WorkoutStep[]
  targetPaceRange?: PaceRange
  targetZone?: Zone
  plannedDistanceKm?: number
  plannedDurationMin?: number
  status: SessionStatus
  linkedRunId?: string
  completedAt?: number
}

export interface Run {
  id: string
  date: string
  source: RunSource
  distanceKm: number
  durationSec: number
  avgPaceSecPerKm: number
  feel?: Feel
  effortRPE?: number // 1–10
  notes?: string
  splits?: Split[]
  avgHR?: number
  maxHR?: number
  elevationGainM?: number
  track?: string // polyline-encoded (populated by import, Ph4)
  rawFileName?: string
  matchedSessionId?: string
  createdAt: number
}

export type RecordKind =
  | 'fastest5k'
  | 'fastest10k'
  | 'fastestHalf'
  | 'fastestFull'
  | 'longestRun'
  | 'biggestWeek'
  | 'longestStreak'

export interface PRRecord {
  id: string
  kind: RecordKind
  value: number
  runId?: string
  achievedAt: number
}

export interface Achievement {
  id: string
  badgeId: string
  unlockedAt: number
}

export interface WeekSummary {
  weekStart: string
  plannedSessions: number
  completedSessions: number
  plannedKm: number
  actualKm: number
  avgFeel?: number
}

export interface Recap {
  id: string
  weekStart: string
  summary: WeekSummary
  recapText: string
  engine: 'rule' | 'ai'
}

export interface ChatMessage {
  id: string
  role: 'user' | 'coach'
  text: string
  createdAt: number
}

export interface AppSettings {
  id: string // singleton: 'app'
  theme: 'dark' | 'light'
  coachEngine: 'rule' | 'ai'
  notificationsEnabled: boolean
  lastBackupAt?: number
}
