import { FRAME_DEMOS } from './manifest'

/**
 * Demo media lives in `public/demos/` and is addressed by exercise id, so adding
 * or upgrading a demo is a file drop plus a manifest regen — no component change.
 *
 * Two kinds are supported, checked in this order:
 *
 * 1. **Video** — `<id>.mp4`. Preferred if you have it: real motion, and a <video>
 *    can be paused for reduced-motion users. Declare ids in `VIDEO_DEMOS`.
 * 2. **Two-frame photos** — `<id>-0.jpg` (start) and `<id>-1.jpg` (end), alternated
 *    to show the movement. This is what the bundled free set uses.
 *
 * Anything with neither falls back to a neutral placeholder.
 */

export type DemoKind = 'video' | 'frames' | 'none'

/**
 * Exercises supplied as an MP4. Empty today — populate this when better clips are
 * licensed, and the video path takes precedence over the photo frames.
 */
export const VIDEO_DEMOS = new Set<string>([])

export function demoKind(exerciseId: string | undefined): DemoKind {
  if (!exerciseId) return 'none'
  if (VIDEO_DEMOS.has(exerciseId)) return 'video'
  if (FRAME_DEMOS.has(exerciseId)) return 'frames'
  return 'none'
}

export function videoSrc(exerciseId: string): string {
  return `/demos/${exerciseId}.mp4`
}

/** Start (0) and end (1) positions of the movement. */
export function frameSrc(exerciseId: string, frame: 0 | 1): string {
  return `/demos/${exerciseId}-${frame}.jpg`
}

export { FRAME_DEMOS }
