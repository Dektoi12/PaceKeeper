import { db } from './db'
import { updateSettings } from './actions'
import { todayISO } from '@/lib/dates'

// Local JSON backup/restore (spec §4). Everything lives in IndexedDB, so a full
// export is just every table dumped into one document the user can save to disk
// and re-import on another device.

const BACKUP_VERSION = 2

const TABLES = [
  'profile',
  'goals',
  'assessments',
  'plans',
  'sessions',
  'runs',
  'records',
  'achievements',
  'recaps',
  'chatMessages',
  'settings',
  'strengthActivityLog',
] as const

type TableName = (typeof TABLES)[number]

export interface BackupFile {
  app: 'pacekeeper'
  version: number
  exportedAt: number
  data: Record<TableName, unknown[]>
}

export function backupFilename(): string {
  return `pacekeeper-backup-${todayISO()}.json`
}

/** Serialize every table to a downloadable JSON Blob and stamp lastBackupAt. */
export async function exportAll(): Promise<Blob> {
  // Stamp first so the backup file itself records when it was made.
  await updateSettings({ lastBackupAt: Date.now() })

  const data = {} as Record<TableName, unknown[]>
  await db.transaction('r', db.tables, async () => {
    for (const name of TABLES) {
      data[name] = await (db.table(name) as unknown as { toArray(): Promise<unknown[]> }).toArray()
    }
  })
  const file: BackupFile = {
    app: 'pacekeeper',
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    data,
  }
  return new Blob([JSON.stringify(file)], { type: 'application/json' })
}

function isBackup(x: unknown): x is BackupFile {
  return (
    typeof x === 'object' &&
    x !== null &&
    (x as BackupFile).app === 'pacekeeper' &&
    typeof (x as BackupFile).data === 'object'
  )
}

/**
 * Replace all local data with the contents of a backup file. Transactional —
 * either the whole restore lands or nothing changes.
 */
export async function importAll(json: string): Promise<void> {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  if (!isBackup(parsed)) {
    throw new Error('That does not look like a PaceKeeper backup.')
  }
  const { data } = parsed

  await db.transaction('rw', db.tables, async () => {
    for (const name of TABLES) {
      const rows = Array.isArray(data[name]) ? data[name] : []
      const table = db.table(name) as unknown as {
        clear(): Promise<void>
        bulkPut(rows: unknown[]): Promise<unknown>
      }
      await table.clear()
      if (rows.length) await table.bulkPut(rows)
    }
  })
}
