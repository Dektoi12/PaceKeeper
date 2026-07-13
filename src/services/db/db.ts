import Dexie, { type Table } from 'dexie'
import type {
  Profile,
  Goal,
  Assessment,
  Plan,
  Session,
  Run,
  PRRecord,
  Achievement,
  Recap,
  ChatMessage,
  AppSettings,
} from './types'

// Single schema version — all tables declared up-front (spec §4) so later
// phases (import, stats, coach) never need a migration.
export class PaceKeeperDB extends Dexie {
  profile!: Table<Profile, string>
  goals!: Table<Goal, string>
  assessments!: Table<Assessment, string>
  plans!: Table<Plan, string>
  sessions!: Table<Session, string>
  runs!: Table<Run, string>
  records!: Table<PRRecord, string>
  achievements!: Table<Achievement, string>
  recaps!: Table<Recap, string>
  chatMessages!: Table<ChatMessage, string>
  settings!: Table<AppSettings, string>

  constructor() {
    super('pacekeeper')
    this.version(1).stores({
      // Only index fields we query on. Complex fields (steps, splits) live in the row.
      profile: 'id',
      goals: 'id, status, targetDate',
      assessments: 'id, date',
      plans: 'id, goalId, status',
      sessions: 'id, planId, date, weekNumber, status, type',
      runs: 'id, date, matchedSessionId, source',
      records: 'id, kind',
      achievements: 'id, badgeId',
      recaps: 'id, weekStart',
      chatMessages: 'id, createdAt',
      settings: 'id',
    })
  }
}

export const db = new PaceKeeperDB()

export const PROFILE_ID = 'me'
export const SETTINGS_ID = 'app'

/** Ask the browser not to evict IndexedDB (spec §4 storage safety). */
export async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage?.persist) {
    try {
      if (await navigator.storage.persisted()) return true
      return await navigator.storage.persist()
    } catch {
      return false
    }
  }
  return false
}

export async function getSettings(): Promise<AppSettings> {
  const existing = await db.settings.get(SETTINGS_ID)
  if (existing) return existing
  const fresh: AppSettings = {
    id: SETTINGS_ID,
    theme: 'dark',
    coachEngine: 'rule',
    notificationsEnabled: false,
  }
  await db.settings.put(fresh)
  return fresh
}
