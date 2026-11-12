import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { gsap, prefersReducedMotion } from '../../lib/motion'
import { IconChevronLeft, IconChevronRight, IconX } from '../icons'
import { TOUR_STEPS } from './steps'

/**
 * The guided tour (GCash-style coach marks): the whole screen dims except a
 * spotlight around one part of the page, with a speech bubble and a bobbing
 * arrow pointing at it. Next / Back glide the spotlight from part to part.
 *
 * Positioning is done imperatively (GSAP + direct style writes) rather than
 * through React state, so following the page while it scrolls doesn't
 * re-render the bubble on every frame. Clicks on the dimmed page are
 * swallowed — only the bubble's own buttons work while the tour is open.
 */

type Box = { left: number; top: number; width: number; height: number }

const PAD = 8 // spotlight breathing room around the target
const GAP = 40 // target → bubble distance (the arrow lives in this gap)
const MARGIN = 12 // keep the bubble this far from the screen edges
const MAX_BUBBLE = 360

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max)

const isVisible = (el: Element) => {
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0
}

/** The first *visible* element with this tour name — the desktop and phone navs share one. */
const findTarget = (name: string): HTMLElement | null => {
  const all = document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)
  for (const el of all) if (isVisible(el)) return el
  return null
}

const waitForTarget = async (name: string, timeoutMs: number) => {
  const until = Date.now() + timeoutMs
  for (;;) {
    const el = findTarget(name)
    if (el || Date.now() >= until) return el
    await sleep(100)
  }
}

/** Room taken by the sticky header and the phone's bottom bar. */
const screenInsets = () => {
  const header = document.querySelector('header')
  const top = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0
  const bottomNav = document.querySelector('[data-bottom-nav]')
  const bottom = bottomNav && isVisible(bottomNav) ? bottomNav.getBoundingClientRect().height : 0
  return { top, bottom }
}

/** Already always on screen — never scroll the page for these. */
const isPinned = (el: Element) => Boolean(el.closest('header, [data-bottom-nav]'))

/** Scrolls so the target (plus room for the bubble) sits in view, then waits for the scroll to settle. */
const scrollToTarget = async (el: HTMLElement) => {
  if (isPinned(el)) return
  const { top, bottom } = screenInsets()
  const r = el.getBoundingClientRect()
  const available = window.innerHeight - top - bottom
  const bubbleRoom = 230
  const offset =
    r.height + bubbleRoom > available ? 16 : Math.max(16, (available - r.height - bubbleRoom) / 2)
  const dest = Math.max(0, window.scrollY + r.top - top - offset)
  if (Math.abs(dest - window.scrollY) < 4) return

  window.scrollTo({ top: dest, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  let last = -1
  let still = 0
  const until = Date.now() + 1000
  while (Date.now() < until) {
    await sleep(50)
    if (Math.abs(window.scrollY - last) < 1) {
      if (++still >= 2) break
    } else {
      still = 0
    }
    last = window.scrollY
  }
}

const TourOverlay = ({ onClose }: { onClose: () => void }) => {
  const navigate = useNavigate()
  const location = useLocation()

  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const spotRef = useRef<HTMLDivElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const arrowRef = useRef<HTMLDivElement>(null)
  const nextButtonRef = useRef<HTMLButtonElement>(null)
  const targetRef = useRef<HTMLElement | null>(null)
  const homeReady = useRef(false)
  const closing = useRef(false)

  const step = TOUR_STEPS[index]
  const isLast = index === TOUR_STEPS.length - 1
  const reduced = prefersReducedMotion()

  // The tour walks the dashboard — go there first if opened from elsewhere.
  useEffect(() => {
    if (location.pathname !== '/') navigate('/')
    // Only on open; later route changes are the tour's own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Places the spotlight, bubble and arrow around the current target. */
  const layout = useCallback(
    (animate: boolean) => {
      const spot = spotRef.current
      const bubble = bubbleRef.current
      const arrow = arrowRef.current
      if (!spot || !bubble || !arrow) return

      const vw = window.innerWidth
      const vh = window.innerHeight
      const el = targetRef.current
      const r = el?.getBoundingClientRect()
      const box: Box | null = r
        ? {
            left: r.left - PAD,
            top: r.top - PAD,
            width: r.width + PAD * 2,
            height: r.height + PAD * 2,
          }
        : null

      // Spotlight: shrinks to a point in the middle for a centred step,
      // which leaves the whole screen dimmed.
      const spotTo = box ?? { left: vw / 2, top: vh / 2, width: 0, height: 0 }
      spot.dataset.empty = box ? 'false' : 'true'
      if (animate && !reduced) {
        gsap.to(spot, { ...spotTo, duration: 0.5, ease: 'power3.inOut', overwrite: true })
      } else {
        gsap.set(spot, { ...spotTo, overwrite: true })
      }

      // Bubble: size first, then measure, then pick a side.
      const width = Math.min(MAX_BUBBLE, vw - MARGIN * 2)
      bubble.style.width = `${width}px`
      const height = bubble.offsetHeight
      const { bottom: insetBottom } = screenInsets()

      let placement: 'below' | 'above' | 'floating' | 'center'
      let top: number
      let left: number
      let arrowLeft = width / 2

      if (!box) {
        placement = 'center'
        top = (vh - height) / 2
        left = (vw - width) / 2
      } else {
        const centerX = box.left + box.width / 2
        left = clamp(centerX - width / 2, MARGIN, vw - width - MARGIN)
        arrowLeft = clamp(centerX - left, 28, width - 28)
        const below = box.top + box.height + GAP
        const above = box.top - GAP - height
        if (below + height <= vh - insetBottom - MARGIN) {
          placement = 'below'
          top = below
        } else if (above >= MARGIN) {
          placement = 'above'
          top = above
        } else {
          // Target fills the screen (a long Records list) — float the
          // bubble over its lower part instead of off-screen.
          placement = 'floating'
          top = vh - insetBottom - MARGIN - height
          left = (vw - width) / 2
        }
      }

      bubble.dataset.placement = placement
      bubble.style.top = `${Math.round(top)}px`
      bubble.style.left = `${Math.round(left)}px`
      arrow.style.left = `${Math.round(arrowLeft)}px`

      if (animate) {
        const from = placement === 'above' ? -12 : 12
        gsap.fromTo(
          bubble,
          { autoAlpha: 0, y: reduced ? 0 : from, scale: reduced ? 1 : 0.97 },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: reduced ? 0.01 : 0.35,
            delay: reduced ? 0 : 0.25,
            ease: 'back.out(1.6)',
            overwrite: true,
          },
        )
      }
    },
    [reduced],
  )

  // A new step's text is in the DOM — lay it out and animate it in.
  useLayoutEffect(() => {
    layout(true)
    nextButtonRef.current?.focus({ preventScroll: true })
  }, [index, layout])

  // Follow the page as it scrolls or the window resizes.
  useEffect(() => {
    let frame = 0
    const onMove = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => layout(false))
    }
    window.addEventListener('scroll', onMove, { passive: true })
    window.addEventListener('resize', onMove)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onMove)
      window.removeEventListener('resize', onMove)
    }
  }, [layout])

  // Fade the dim layer in on open, and keep the arrow bobbing.
  useEffect(() => {
    const root = rootRef.current
    const arrowInner = arrowRef.current?.firstElementChild
    if (root) gsap.fromTo(root, { autoAlpha: 0 }, { autoAlpha: 1, duration: reduced ? 0.01 : 0.3 })
    const bob =
      arrowInner && !reduced
        ? gsap.to(arrowInner, { y: -6, duration: 0.55, ease: 'sine.inOut', repeat: -1, yoyo: true })
        : null
    return () => {
      bob?.kill()
    }
  }, [reduced])

  const close = useCallback(() => {
    if (closing.current) return
    closing.current = true
    const root = rootRef.current
    if (!root || reduced) return onClose()
    gsap.to(root, { autoAlpha: 0, duration: 0.25, onComplete: onClose })
  }, [onClose, reduced])

  /** Moves to step `from`, skipping (in `dir`) any step whose target isn't on screen. */
  const goTo = useCallback(
    async (from: number, dir: 1 | -1) => {
      if (busy) return
      setBusy(true)
      try {
        let i = from
        let target: HTMLElement | null = null
        while (i >= 0 && i < TOUR_STEPS.length) {
          const name = TOUR_STEPS[i].target
          if (name === null) break
          if (!homeReady.current) {
            // The dashboard may still be loading right after opening.
            await waitForTarget('summary', 4000)
            homeReady.current = true
          }
          target = findTarget(name)
          if (target) break
          i += dir
        }
        if (i >= TOUR_STEPS.length) return close()
        if (i < 0) return

        if (bubbleRef.current) {
          gsap.to(bubbleRef.current, { autoAlpha: 0, duration: reduced ? 0.01 : 0.15, overwrite: true })
        }
        if (target) await scrollToTarget(target)
        targetRef.current = target
        setIndex(i)
      } finally {
        setBusy(false)
      }
    },
    [busy, close, reduced],
  )

  const next = useCallback(() => {
    if (isLast) close()
    else void goTo(index + 1, 1)
  }, [close, goTo, index, isLast])

  const back = useCallback(() => {
    if (index > 0) void goTo(index - 1, -1)
  }, [goTo, index])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') back()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [back, close, next])

  const progress = Math.round(((index + 1) / TOUR_STEPS.length) * 100)

  return (
    <div ref={rootRef} className="fixed inset-0 z-[70]" style={{ visibility: 'hidden' }}>
      {/* Swallows every click on the dimmed page. */}
      <div className="absolute inset-0" aria-hidden="true" />

      <div ref={spotRef} className="tour-spot" aria-hidden="true" />

      <div
        ref={bubbleRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className="tour-bubble"
        style={{ visibility: 'hidden' }}
      >
        <div ref={arrowRef} className="tour-arrow" aria-hidden="true">
          <svg width="26" height="30" viewBox="0 0 26 30" fill="none">
            <path
              d="M13 28V4M13 4 4 13M13 4l9 9"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="h-1 overflow-hidden rounded-full bg-panel-2">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-3 flex items-start justify-between gap-3">
          <h2 id="tour-title" className="text-base font-bold text-ink">
            {step.title}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close the tour"
            className="-mr-1 -mt-1 rounded-md p-1 text-muted hover:bg-panel-2 hover:text-ink"
          >
            <IconX size={16} />
          </button>
        </div>
        <p id="tour-body" className="mt-1.5 text-sm leading-relaxed text-muted">
          {step.body}
        </p>

        <div className="mt-4 flex items-center justify-between gap-2">
          {isLast ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={close}
              className="text-xs font-medium text-muted underline-offset-2 hover:text-ink hover:underline"
            >
              Skip tour
            </button>
          )}
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button type="button" onClick={back} disabled={busy} className="btn btn-sm">
                <IconChevronLeft size={14} />
                Back
              </button>
            )}
            <button
              ref={nextButtonRef}
              type="button"
              onClick={next}
              disabled={busy}
              className="btn btn-primary btn-sm"
            >
              {isLast ? 'Done' : index === 0 ? "Let's go" : 'Next'}
              {!isLast && <IconChevronRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TourOverlay
