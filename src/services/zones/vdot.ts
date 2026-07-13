import type { PaceRange, PaceZones } from '@/services/db/types'

// VDOT model (Jack Daniels / Gilbert running formula).
// Race VDOT is derived from a performance; training paces are expressed as
// fractions of vVDOT (velocity at VDOT) — calibrated to match Daniels' tables.

/** Fraction of aerobic capacity sustained for a race of `minutes`. */
function fractionForDuration(minutes: number): number {
  return (
    0.8 +
    0.1894393 * Math.exp(-0.012778 * minutes) +
    0.2989558 * Math.exp(-0.1932605 * minutes)
  )
}

/** VO2 demand (ml/kg/min) of running at `velocity` m/min. */
function vo2ForVelocity(velocity: number): number {
  return -4.6 + 0.182258 * velocity + 0.000104 * velocity * velocity
}

/** Invert vo2ForVelocity → velocity (m/min) for a given VO2. */
function velocityForVo2(vo2: number): number {
  // 0.000104 v^2 + 0.182258 v + (-4.6 - vo2) = 0
  const a = 0.000104
  const b = 0.182258
  const c = -4.6 - vo2
  const disc = b * b - 4 * a * c
  return (-b + Math.sqrt(disc)) / (2 * a)
}

/** VDOT from a race/benchmark result. */
export function vdotFromRace(distanceKm: number, timeSec: number): number {
  if (distanceKm <= 0 || timeSec <= 0) return 0
  const meters = distanceKm * 1000
  const minutes = timeSec / 60
  const velocity = meters / minutes // m/min
  const vo2 = vo2ForVelocity(velocity)
  const frac = fractionForDuration(minutes)
  return vo2 / frac
}

// Zone bounds as [slowFraction, fastFraction] of vVDOT velocity.
const ZONE_FRACTIONS: Record<keyof PaceZones, [number, number]> = {
  easy: [0.65, 0.73],
  marathon: [0.755, 0.78],
  threshold: [0.8, 0.84],
  interval: [0.93, 0.98],
  repetition: [1.0, 1.05],
}

function rangeFromFractions(vVdot: number, [slow, fast]: [number, number]): PaceRange {
  const slowVel = slow * vVdot
  const fastVel = fast * vVdot
  return {
    minSecPerKm: 60000 / fastVel, // faster pace = fewer seconds
    maxSecPerKm: 60000 / slowVel,
  }
}

export function paceZonesFromVdot(vdot: number): PaceZones {
  const vVdot = velocityForVo2(vdot) // velocity at 100% VDOT
  return {
    easy: rangeFromFractions(vVdot, ZONE_FRACTIONS.easy),
    marathon: rangeFromFractions(vVdot, ZONE_FRACTIONS.marathon),
    threshold: rangeFromFractions(vVdot, ZONE_FRACTIONS.threshold),
    interval: rangeFromFractions(vVdot, ZONE_FRACTIONS.interval),
    repetition: rangeFromFractions(vVdot, ZONE_FRACTIONS.repetition),
  }
}

/** Predict an equivalent race time (sec) for a distance at a given VDOT. */
export function predictTimeSec(vdot: number, distanceKm: number): number {
  const meters = distanceKm * 1000
  // Solve for minutes s.t. vo2ForVelocity(meters/min) / fractionForDuration(min) = vdot.
  // Monotonic in minutes → bisection.
  let lo = 1
  let hi = 1200 // up to 20h
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    const velocity = meters / mid
    const est = vo2ForVelocity(velocity) / fractionForDuration(mid)
    if (est > vdot) lo = mid
    else hi = mid
  }
  return ((lo + hi) / 2) * 60
}
