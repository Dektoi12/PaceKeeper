import type { Run, Session } from '@/services/db/types'
import { weekStartISO, fromISO, toISO, addDays, format } from '@/lib/dates'

// Aggregations that feed the Stats charts (spec §5). All pure — screens pass in
// runs (+ sessions for planned overlays) and get chart-ready rows back.

export interface WeeklyMileagePoint {
  week: string // ISO Monday
  label: string // e.g. "Jul 7"
  actualKm: number
  plannedKm: number
}

/** Planned-vs-actual weekly mileage for the last `weeks` calendar weeks. */
export function weeklyMileage(runs: Run[], sessions: Session[], weeks = 12): WeeklyMileagePoint[] {
  const actual = new Map<string, number>()
  for (const r of runs) {
    const wk = weekStartISO(fromISO(r.date))
    actual.set(wk, (actual.get(wk) ?? 0) + r.distanceKm)
  }
  const planned = new Map<string, number>()
  for (const s of sessions) {
    if (!s.plannedDistanceKm) continue
    const wk = weekStartISO(fromISO(s.date))
    planned.set(wk, (planned.get(wk) ?? 0) + s.plannedDistanceKm)
  }

  const thisWeek = fromISO(weekStartISO(new Date()))
  const points: WeeklyMileagePoint[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const wkDate = addDays(thisWeek, -7 * i)
    const wk = toISO(wkDate)
    points.push({
      week: wk,
      label: format(wkDate, 'MMM d'),
      actualKm: Math.round((actual.get(wk) ?? 0) * 10) / 10,
      plannedKm: Math.round((planned.get(wk) ?? 0) * 10) / 10,
    })
  }
  return points
}

export interface MonthlyTotalPoint {
  month: string // yyyy-MM
  label: string // e.g. "Jul"
  km: number
  runs: number
}

export function monthlyTotals(runs: Run[]): MonthlyTotalPoint[] {
  const map = new Map<string, { km: number; runs: number }>()
  for (const r of runs) {
    const key = r.date.slice(0, 7)
    const m = map.get(key) ?? { km: 0, runs: 0 }
    m.km += r.distanceKm
    m.runs += 1
    map.set(key, m)
  }
  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([month, v]) => ({
      month,
      label: format(fromISO(`${month}-01`), 'MMM'),
      km: Math.round(v.km * 10) / 10,
      runs: v.runs,
    }))
}

export interface PaceTrendPoint {
  date: string
  paceSecPerKm: number
}

/**
 * Easy-pace trend line. Uses runs matched to easy sessions when session context
 * is available; otherwise falls back to the slower half of runs (a decent proxy
 * for easy/recovery efforts).
 */
export function easyPaceTrend(runs: Run[], easyRunIds?: Set<string>): PaceTrendPoint[] {
  let pool: Run[]
  if (easyRunIds && easyRunIds.size) {
    pool = runs.filter((r) => easyRunIds.has(r.id))
  } else {
    const sorted = [...runs].sort((a, b) => a.avgPaceSecPerKm - b.avgPaceSecPerKm)
    const median = sorted[Math.floor(sorted.length / 2)]?.avgPaceSecPerKm ?? Infinity
    pool = runs.filter((r) => r.avgPaceSecPerKm >= median)
  }
  return pool
    .filter((r) => r.avgPaceSecPerKm > 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((r) => ({ date: r.date, paceSecPerKm: Math.round(r.avgPaceSecPerKm) }))
}

export interface HeatmapCell {
  date: string
  count: number
  km: number
}

/** Per-day run tally for the last `days` days (for a consistency heatmap). */
export function consistencyHeatmap(runs: Run[], days = 119): HeatmapCell[] {
  const byDay = new Map<string, { count: number; km: number }>()
  for (const r of runs) {
    const c = byDay.get(r.date) ?? { count: 0, km: 0 }
    c.count += 1
    c.km += r.distanceKm
    byDay.set(r.date, c)
  }
  const today = new Date()
  const cells: HeatmapCell[] = []
  for (let i = days - 1; i >= 0; i--) {
    const iso = toISO(addDays(today, -i))
    const c = byDay.get(iso)
    cells.push({ date: iso, count: c?.count ?? 0, km: c ? Math.round(c.km * 10) / 10 : 0 })
  }
  return cells
}
