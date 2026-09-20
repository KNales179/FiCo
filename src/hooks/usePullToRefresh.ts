import { useEffect, useRef, useState } from 'react'

/** Damped pull distance (px) needed before letting go actually refreshes. */
export const PULL_THRESHOLD = 70
const MAX_PULL = 110
/** Finger travel is halved so the pull feels like it's resisting. */
const DAMPING = 0.5
/** Keep the "refreshing" state up at least this long so it never just flickers. */
const MIN_REFRESH_MS = 700

export type PullPhase = 'idle' | 'pulling' | 'ready' | 'refreshing'

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * The standard touch "pull down from the top to refresh" gesture, for an
 * installed PWA / mobile browser where there's no native one to lean on.
 *
 * Only starts when the page is already scrolled to the very top, with a
 * single finger, and not on a form control or inside an open dialog — so it
 * never fights normal scrolling, typing, or a modal. It also switches the
 * browser's own overscroll refresh off while mounted, so a pull can't
 * trigger two refreshes at once.
 */
export const usePullToRefresh = (onRefresh: () => Promise<void>) => {
  const [distance, setDistance] = useState(0)
  const [phase, setPhase] = useState<PullPhase>('idle')

  const refreshRef = useRef(onRefresh)
  const startX = useRef(0)
  const startY = useRef<number | null>(null)
  const distanceRef = useRef(0)
  const busy = useRef(false)

  useEffect(() => {
    refreshRef.current = onRefresh
  })

  useEffect(() => {
    const root = document.documentElement
    const previousOverscroll = root.style.overscrollBehaviorY
    root.style.overscrollBehaviorY = 'contain'

    const atTop = () =>
      (document.scrollingElement?.scrollTop ?? window.scrollY) <= 0

    const settle = () => {
      startY.current = null
      distanceRef.current = 0
      setDistance(0)
      setPhase('idle')
    }

    const onStart = (event: TouchEvent) => {
      if (busy.current || event.touches.length !== 1 || !atTop()) return
      const target = event.target as Element | null
      if (target?.closest('input, textarea, select, [data-no-pull]')) return
      if (document.querySelector('[role="dialog"]')) return
      startX.current = event.touches[0].clientX
      startY.current = event.touches[0].clientY
    }

    const onMove = (event: TouchEvent) => {
      if (startY.current === null || busy.current) return
      const dy = event.touches[0].clientY - startY.current
      const dx = event.touches[0].clientX - startX.current

      // Scrolling up, drifting sideways, or the page moved off the top — not a pull.
      if (dy <= 0 || !atTop() || Math.abs(dx) > Math.abs(dy)) {
        if (distanceRef.current > 0) settle()
        else startY.current = null
        return
      }

      if (event.cancelable) event.preventDefault()
      const next = Math.min(dy * DAMPING, MAX_PULL)
      distanceRef.current = next
      setDistance(next)
      setPhase(next >= PULL_THRESHOLD ? 'ready' : 'pulling')
    }

    const onEnd = async () => {
      if (startY.current === null) return
      const shouldRefresh = distanceRef.current >= PULL_THRESHOLD
      startY.current = null

      if (!shouldRefresh) {
        settle()
        return
      }

      busy.current = true
      setPhase('refreshing')
      distanceRef.current = PULL_THRESHOLD * 0.75
      setDistance(distanceRef.current)
      try {
        await Promise.all([refreshRef.current(), wait(MIN_REFRESH_MS)])
      } catch {
        // A failed refresh just ends the gesture — the sync status already reports why.
      } finally {
        busy.current = false
        settle()
      }
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', settle)

    return () => {
      root.style.overscrollBehaviorY = previousOverscroll
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', settle)
    }
  }, [])

  return { distance, phase }
}
