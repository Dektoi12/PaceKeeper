import type { PaceRange, Units } from '@/services/db/types'

export const KM_PER_MI = 1.60934

export function kmToUnit(km: number, units: Units): number {
  return units === 'mi' ? km / KM_PER_MI : km
}

export function unitToKm(value: number, units: Units): number {
  return units === 'mi' ? value * KM_PER_MI : value
}

export function unitLabel(units: Units): string {
  return units === 'mi' ? 'mi' : 'km'
}

/** Distance for display, e.g. "6.4 km". */
export function formatDistance(km: number, units: Units, digits = 1): string {
  const v = kmToUnit(km, units)
  return `${v.toFixed(digits)} ${unitLabel(units)}`
}

/** Seconds → "m:ss" or "h:mm:ss". */
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

/** Pace stored as sec/km → display per user's unit, e.g. "5:38 /km". */
export function formatPace(secPerKm: number, units: Units): string {
  if (!isFinite(secPerKm) || secPerKm <= 0) return '—'
  const perUnit = units === 'mi' ? secPerKm * KM_PER_MI : secPerKm
  const m = Math.floor(perUnit / 60)
  const s = Math.round(perUnit % 60)
  const mm = s === 60 ? m + 1 : m
  const ss = s === 60 ? 0 : s
  return `${mm}:${String(ss).padStart(2, '0')} /${unitLabel(units)}`
}

export function formatPaceRange(range: PaceRange | undefined, units: Units): string {
  if (!range) return '—'
  const lo = formatPace(range.maxSecPerKm, units) // slower = larger number = "min pace"
  const hi = formatPace(range.minSecPerKm, units)
  // Show fast–slow order for readability, drop the trailing unit on the first.
  const hiNum = hi.split(' ')[0]
  return `${hiNum}–${lo}`
}

export function paceFromDistanceDuration(distanceKm: number, durationSec: number): number {
  if (distanceKm <= 0) return 0
  return durationSec / distanceKm
}

/** Parse "mm:ss" or "h:mm:ss" into seconds. Returns null on invalid. */
export function parseDurationInput(input: string): number | null {
  const parts = input.trim().split(':').map((p) => p.trim())
  if (parts.some((p) => p === '' || isNaN(Number(p)))) return null
  const nums = parts.map(Number)
  if (nums.length === 1) return nums[0]
  if (nums.length === 2) return nums[0] * 60 + nums[1]
  if (nums.length === 3) return nums[0] * 3600 + nums[1] * 60 + nums[2]
  return null
}
