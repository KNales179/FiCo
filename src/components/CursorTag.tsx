import { useEffect, useRef } from 'react'
import { gsap, prefersReducedMotion } from '../lib/motion'
import { IconArrowUpRight } from './icons'

/**
 * A tag that says what a button or link does (idea from Resolve UK, in
 * Fico's own look: glass, an accent border, your colour).
 *
 * - Website (front page, sign-in): follows the mouse over every link and button.
 * - In the app: only icon buttons (no visible words), after a short pause,
 *   so it explains icons without getting in the way of everything else.
 * - Touch screens: press and hold a button to see its tag above your finger.
 *
 * The label is the element's `data-tag`, else its aria-label, else its
 * title, else (website only) its text. Off with reduced motion.
 */
const SELECTOR = 'a:not([data-no-tag]), button:not([data-no-tag]):not(:disabled), [role="button"]:not([data-no-tag])'
const APP_DELAY_MS = 350
const LONG_PRESS_MS = 450

const isWebsite = () => Boolean(document.querySelector('.auth-backdrop'))

const visibleText = (el: HTMLElement) => el.textContent?.replace(/\s+/g, ' ').trim() ?? ''

const labelFor = (el: HTMLElement, website: boolean): string | null => {
  const named = el.getAttribute('data-tag') || el.getAttribute('aria-label') || el.getAttribute('title')
  // In the app, buttons that already say what they do in words need no tag.
  if (!website && !el.getAttribute('data-tag') && visibleText(el)) return null
  const text = named || (website ? visibleText(el) : '')
  if (!text) return null
  return text.length > 44 ? `${text.slice(0, 42)}…` : text
}

const CursorTag = () => {
  const tagRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (prefersReducedMotion()) return
    const tagEl = tagRef.current
    const textEl = textRef.current
    if (!tagEl || !textEl) return

    gsap.set(tagEl, { x: -9999, y: -9999, rotation: -2, scale: 0.85, opacity: 0 })
    const moveX = gsap.quickTo(tagEl, 'x', { duration: 0.2, ease: 'power3.out' })
    const moveY = gsap.quickTo(tagEl, 'y', { duration: 0.2, ease: 'power3.out' })
    const fade = gsap.quickTo(tagEl, 'opacity', { duration: 0.18, ease: 'power2.out' })
    const grow = gsap.quickTo(tagEl, 'scale', { duration: 0.22, ease: 'back.out(1.7)' })
    const cleanups: Array<() => void> = []

    // ── Mouse: follow it ──────────────────────────────────────────────
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      let active: HTMLElement | null = null
      let shown = false
      let since = 0
      let x = 0
      let y = 0
      let hasPointer = false
      const onMove = (e: MouseEvent) => {
        x = e.clientX
        y = e.clientY
        hasPointer = true
      }
      const onLeave = () => {
        hasPointer = false
      }
      const onVisibility = () => {
        if (document.hidden) hasPointer = false
      }
      // Re-check what's under the mouse every frame (a fast flick can skip
      // mousemove events and leave a tag stuck otherwise).
      let raf = 0
      const tick = () => {
        raf = requestAnimationFrame(tick)
        const website = isWebsite()
        let next: HTMLElement | null = null
        if (hasPointer) {
          const target = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>(SELECTOR)
          next = target && labelFor(target, website) ? target : null
        }
        if (next !== active) {
          active = next
          since = performance.now()
          shown = false
          if (active) textEl.textContent = labelFor(active, website)
        }
        // In the app, wait a moment first — a tooltip, not a chaser.
        if (active && !shown && (website || performance.now() - since >= APP_DELAY_MS)) shown = true
        fade(shown ? 1 : 0)
        grow(shown ? 1 : 0.85)
        if (active) {
          moveX(x + 16)
          moveY(y + 18)
        }
      }
      raf = requestAnimationFrame(tick)
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseleave', onLeave)
      document.addEventListener('visibilitychange', onVisibility)
      cleanups.push(() => {
        cancelAnimationFrame(raf)
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseleave', onLeave)
        document.removeEventListener('visibilitychange', onVisibility)
      })
    }

    // ── Touch: press and hold ──────────────────────────────────────────
    let pressTimer = 0
    let hideTimer = 0
    let startX = 0
    let startY = 0
    const hide = () => {
      fade(0)
      grow(0.85)
    }
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const target = (e.target as HTMLElement | null)?.closest<HTMLElement>(SELECTOR)
      // On touch, any button with a name can explain itself (there's no hover to learn from).
      const label = target ? labelFor(target, true) : null
      if (!label) return
      const t = e.touches[0]
      startX = t.clientX
      startY = t.clientY
      window.clearTimeout(pressTimer)
      window.clearTimeout(hideTimer)
      pressTimer = window.setTimeout(() => {
        textEl.textContent = label
        const w = tagEl.offsetWidth || 120
        // Above the finger, kept on screen.
        const left = Math.min(Math.max(8, startX - w / 2), window.innerWidth - w - 8)
        gsap.set(tagEl, { x: left, y: Math.max(8, startY - 64) })
        fade(1)
        grow(1)
        navigator.vibrate?.(10)
      }, LONG_PRESS_MS)
    }
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0]
      if (t && Math.hypot(t.clientX - startX, t.clientY - startY) > 10) window.clearTimeout(pressTimer)
    }
    const onTouchEnd = () => {
      window.clearTimeout(pressTimer)
      hideTimer = window.setTimeout(hide, 1400)
    }
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEnd)
    document.addEventListener('touchcancel', onTouchEnd)
    cleanups.push(() => {
      window.clearTimeout(pressTimer)
      window.clearTimeout(hideTimer)
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchEnd)
    })

    return () => cleanups.forEach((fn) => fn())
  }, [])

  return (
    <div ref={tagRef} className="pointer-events-none fixed left-0 top-0 z-[999] opacity-0" aria-hidden="true">
      <span className="cursor-tag">
        <span className="cursor-tag-mark">
          <IconArrowUpRight size={11} />
        </span>
        <span ref={textRef} />
      </span>
    </div>
  )
}

export default CursorTag
