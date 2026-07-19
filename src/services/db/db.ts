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
  StrengthActivityLog,
} from './types'

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
  strengthActivityLog!: Table<StrengthActivityLog, string>

  constructor() {
    super('pacekeeper')
    // v1 — original schema. Only index fields we query on; complex fields
    // (steps, splits) live unindexed in the row.
    this.version(1).stores({
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
    // v2 — strength manual/external activity log (spec §4.5). Additive: no
    // changes to existing stores, so existing rows migrate untouched.
    this.version(2).stores({
      strengthActivityLog: 'id, date',
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
