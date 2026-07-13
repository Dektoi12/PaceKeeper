import { db } from '@/services/db/db'
import type { PRRecord, RecordKind, Run } from '@/services/db/types'
import { uid } from '@/lib/id'
import { weekStartISO, fromISO } from '@/lib/dates'

// Personal-record engine (spec §5). v1 tracks whole-run efforts only — fastest
// standard-distance runs (normalized to the exact distance so a 5.07 km run is
// comparable to a 4.96 km one), longest run, biggest week, longest day streak.
// Rolling-window PRs inside long runs are a deliberate Future item.

const STANDARD_DISTANCES: { kind: RecordKind; km: number }[] = [
  { kind: 'fastest5k', km: 5 },
  { kind: 'fastest10k', km: 10 },
  { kind: 'fastestHalf', km: 21.0975 },
  { kind: 'fastestFull', km: 42.195 },
]

const DISTANCE_TOLERANCE = 0.02 // ±2% to count as that distance

export const RECORD_LABELS: Record<RecordKind, string> = {
  fastest5k: 'Fastest 5K',
  fastest10k: 'Fastest 10K',
  fastestHalf: 'Fastest half',
  fastestFull: 'Fastest marathon',
  longestRun: 'Longest run',
  biggestWeek: 'Biggest week',
  longestStreak: 'Longest streak',
}

/** Preferred display order for the PR grid. */
export const RECORD_ORDER: RecordKind[] = [
  'fastest5k',
  'fastest10k',
  'fastestHalf',
  'fastestFull',
  'longestRun',
  'biggestWeek',
  'longestStreak',
]

/** Lower-is-better for time PRs; higher-is-better for the rest. */
export function isTimeRecord(kind: RecordKind): boolean {
  return kind.startsWith('fastest')
}

export function isBetter(kind: RecordKind, next: number, prev: number | undefined): boolean {
  if (prev == null) return true
  return isTimeRecord(kind) ? next < prev : next > prev
}

interface Candidate {
  kind: RecordKind
  value: number
  runId?: string
  achievedAt: number
}

/**
 * Compute the best value per record kind across all runs. Returns one candidate
 * per kind that has any qualifying data (missing kinds are simply absent).
 */
export function computePRs(runs: Run[]): Candidate[] {
  const out: Candidate[] = []
  if (!runs.length) return out

  // Fastest standard distances — normalized time = pace × exact distance.
  for (const { kind, km } of STANDARD_DISTANCES) {
    let best: Candidate | undefined
    for (const r of runs) {
      if (r.distanceKm <= 0 || r.durationSec <= 0) continue
      if (Math.abs(r.distanceKm - km) / km > DISTANCE_TOLERANCE) continue
      const value = Math.round(r.avgPaceSecPerKm * km)
      if (!best || value < best.value) {
        best = { kind, value, runId: r.id, achievedAt: r.createdAt }
      }
    }
    if (best) out.push(best)
  }

  // Longest single run (km).
  {
    let best: Candidate | undefined
    for (const r of runs) {
      if (!best || r.distanceKm > best.value) {
        best = { kind: 'longestRun', value: r.distanceKm, runId: r.id, achievedAt: r.createdAt }
      }
    }
    if (best) out.push(best)
  }

  // Biggest calendar week by total distance (km).
  {
    const byWeek = new Map<string, number>()
    for (const r of runs) {
      const wk = weekStartISO(fromISO(r.date))
      byWeek.set(wk, (byWeek.get(wk) ?? 0) + r.distanceKm)
    }
    let bestKm = 0
    for (const km of byWeek.values()) bestKm = Math.max(bestKm, km)
    if (bestKm > 0) {
      out.push({ kind: 'biggestWeek', value: Math.round(bestKm * 10) / 10, achievedAt: Date.now() })
    }
  }

  // Longest streak of consecutive calendar days with at least one run.
  {
    const days = Array.from(new Set(runs.map((r) => r.date))).sort()
    let longest = 0
    let current = 0
    let prev: Date | undefined
    for (const d of days) {
      const cur = fromISO(d)
      if (prev && (cur.getTime() - prev.getTime()) / 86_400_000 === 1) current += 1
      else current = 1
      longest = Math.max(longest, current)
      prev = cur
    }
    if (longest > 0) out.push({ kind: 'longestStreak', value: longest, achievedAt: Date.now() })
  }

  return out
}

/**
 * Recompute PRs from all runs and upsert into `db.records`. Returns the kinds
 * that were newly set or improved, so callers can fire a celebration.
 */
export async function upsertRecords(runs: Run[]): Promise<RecordKind[]> {
  const candidates = computePRs(runs)
  const improved: RecordKind[] = []

  await db.transaction('rw', db.records, async () => {
    const existing = await db.records.toArray()
    const byKind = new Map<RecordKind, PRRecord>()
    for (const rec of existing) byKind.set(rec.kind, rec)

    for (const c of candidates) {
      const prev = byKind.get(c.kind)
      if (!isBetter(c.kind, c.value, prev?.value)) continue
      improved.push(c.kind)
      const record: PRRecord = {
        id: prev?.id ?? uid(),
        kind: c.kind,
        value: c.value,
        runId: c.runId,
        achievedAt: c.achievedAt,
      }
      await db.records.put(record)
    }
  })

  return improved
}
