import { useEffect, useRef, useState } from 'react'
import { demoKind, frameSrc, videoSrc } from './media'

/**
 * The one way exercises are illustrated across the app — strength player, routine
 * player and the exercise info sheet all render this, so the look stays uniform.
 *
 * Demos are optional: an exercise with no media shows a neutral placeholder rather
 * than a broken image, so the app is fully usable at partial coverage.
 */

/** How long each position of a two-frame demo is held. */
const FRAME_MS = 1100

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}

function Placeholder({ size }: { size: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={Math.round(size * 0.34)}
      height={Math.round(size * 0.34)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-slate-600"
      role="presentation"
      aria-hidden="true"
    >
      <circle cx="12" cy="4.5" r="2.2" />
      <path d="M12 7v6M12 13l-3 5M12 13l3 5M7.5 9.5 12 8.4l4.5 1.1" />
    </svg>
  )
}

/**
 * Cross-fades between the start and end position. Both frames stay mounted so the
 * swap never flashes an unloaded image.
 */
function FrameDemo({ exerciseId, reduced }: { exerciseId: string; reduced: boolean }) {
  // Reduced motion rests on the end position — it shows the working shape of the
  // movement, which is the more useful still.
  const [showEnd, setShowEnd] = useState(true)

  useEffect(() => {
    if (reduced) {
      setShowEnd(true)
      return
    }
    const timer = window.setInterval(() => setShowEnd((s) => !s), FRAME_MS)
    return () => window.clearInterval(timer)
  }, [reduced, exerciseId])

  return (
    <>
      {([0, 1] as const).map((frame) => (
        <img
          key={frame}
          src={frameSrc(exerciseId, frame)}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
          style={{ opacity: (frame === 1) === showEnd ? 1 : 0 }}
        />
      ))}
    </>
  )
}

export function ExerciseDemo({
  exerciseId,
  size = 160,
  className = '',
}: {
  exerciseId?: string
  size?: number
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const reduced = usePrefersReducedMotion()
  const video = useRef<HTMLVideoElement>(null)
  const kind = demoKind(exerciseId)

  // Reset when moving between exercises, otherwise one missing demo would keep the
  // placeholder pinned for every later exercise.
  useEffect(() => setFailed(false), [exerciseId])

  useEffect(() => {
    const el = video.current
    if (!el) return
    if (reduced) el.pause()
    else void el.play().catch(() => {})
  }, [reduced, exerciseId, failed])

  const shell = `relative flex items-center justify-center overflow-hidden rounded-card bg-ink-800/60 ${className}`
  const style = { width: size, height: size }

  if (!exerciseId || kind === 'none' || failed) {
    return (
      <div className={shell} style={style}>
        <Placeholder size={size} />
      </div>
    )
  }

  return (
    <div className={shell} style={style}>
      {kind === 'video' ? (
        <video
          ref={video}
          src={videoSrc(exerciseId)}
          className="w-full h-full object-cover"
          autoPlay={!reduced}
          loop
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
          onError={() => setFailed(true)}
        />
      ) : (
        <FrameDemo exerciseId={exerciseId} reduced={reduced} />
      )}
    </div>
  )
}
