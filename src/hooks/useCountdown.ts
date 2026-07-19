import { useEffect, useRef, useState } from 'react'

/** Simple 1-second countdown, shared by the strength and routine players. */
export function useCountdown(onDone?: () => void) {
  const [remaining, setRemaining] = useState(0)
  const [active, setActive] = useState(false)
  const timer = useRef<number>()
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    if (!active) return
    timer.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          window.clearInterval(timer.current)
          setActive(false)
          done.current?.()
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => window.clearInterval(timer.current)
  }, [active])

  return {
    remaining,
    active,
    start: (sec: number) => {
      if (sec <= 0) return
      setRemaining(sec)
      setActive(true)
    },
    stop: () => {
      window.clearInterval(timer.current)
      setActive(false)
      setRemaining(0)
    },
  }
}
