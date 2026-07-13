import { buildRunImport } from './preview'
import type { LapSummary, RunImport, TrackPoint } from './types'

// FIT is Garmin's binary format. The SDK is heavy (~hundreds of KB) so it is
// dynamically imported here — this module is only ever pulled in when a user
// actually picks a .fit file.

const SEMICIRCLE_TO_DEG = 180 / 2 ** 31

function toMs(t: unknown): number | undefined {
  if (t instanceof Date) return t.getTime()
  if (typeof t === 'number') return t
  return undefined
}

function firstNumber(obj: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  return undefined
}

export async function parseFit(buf: ArrayBuffer, rawFileName: string): Promise<RunImport> {
  const { Decoder, Stream } = await import('@garmin/fitsdk')
  const stream = Stream.fromByteArray(new Uint8Array(buf))
  const decoder = new Decoder(stream)
  if (!decoder.isFIT() || !decoder.checkIntegrity()) {
    throw new Error('This file is not a valid FIT file.')
  }
  const { messages } = decoder.read()

  const records = (messages.recordMesgs ?? []) as unknown as Record<string, unknown>[]
  const points: TrackPoint[] = records.map((r) => {
    const lat = firstNumber(r, ['positionLat'])
    const lng = firstNumber(r, ['positionLong'])
    return {
      lat: lat != null ? lat * SEMICIRCLE_TO_DEG : undefined,
      lng: lng != null ? lng * SEMICIRCLE_TO_DEG : undefined,
      ele: firstNumber(r, ['enhancedAltitude', 'altitude']),
      hr: firstNumber(r, ['heartRate']),
      time: toMs(r.timestamp),
    }
  })

  const lapMesgs = (messages.lapMesgs ?? []) as unknown as Record<string, unknown>[]
  const laps: LapSummary[] = lapMesgs.map((l) => ({
    distanceKm: (firstNumber(l, ['totalDistance']) ?? 0) / 1000,
    durationSec: firstNumber(l, ['totalTimerTime', 'totalElapsedTime']) ?? 0,
    avgHR: firstNumber(l, ['avgHeartRate']),
    maxHR: firstNumber(l, ['maxHeartRate']),
  }))

  const result = buildRunImport('fit', rawFileName, points, laps)

  // Prefer the session summary for totals when geometry is thin — a FIT session
  // records authoritative distance/time/HR.
  const session = (messages.sessionMesgs ?? [])[0] as Record<string, unknown> | undefined
  if (session) {
    const sessDist = firstNumber(session, ['totalDistance'])
    const sessTime = firstNumber(session, ['totalTimerTime', 'totalElapsedTime'])
    if (result.totalsOnly && sessDist) {
      result.distanceKm = Math.round((sessDist / 1000) * 1000) / 1000
    }
    if (result.totalsOnly && sessTime) {
      result.durationSec = Math.round(sessTime)
      result.avgPaceSecPerKm =
        result.distanceKm > 0 ? Math.round(result.durationSec / result.distanceKm) : 0
    }
    if (result.avgHR == null) result.avgHR = firstNumber(session, ['avgHeartRate'])
    if (result.maxHR == null) result.maxHR = firstNumber(session, ['maxHeartRate'])
  }

  return result
}
