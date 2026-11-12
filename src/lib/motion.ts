import { useLayoutEffect, type RefObject } from 'react'
import { gsap } from 'gsap'

/**
 * Motion helpers (GSAP). Every animation here is decoration only: content is
 * fully visible without it, it never runs for anyone who asked their device
 * for less motion, and each tween clears its inline styles when done. That
 * last part matters — a leftover `transform` on a card would turn it into the
 * containing block for any `position: fixed` child (Fico's Modal renders in
 * place, not in a portal), pinning the dialog inside the card instead of the
 * viewport.
 */

export { gsap }

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/**
 * Fades and lifts the direct children of `ref` into place, one after another.
 * Re-runs whenever `key` changes (e.g. once loading finishes, or on a new
 * route) — pass `null` to skip a run.
 */
export const useStaggerIn = (
  ref: RefObject<HTMLElement | null>,
  key: unknown,
  options: { y?: number; stagger?: number; selector?: string } = {},
) => {
  const { y = 14, stagger = 0.06, selector = ':scope > *' } = options

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || key === null || prefersReducedMotion()) return
    const targets = el.querySelectorAll(selector)
    if (targets.length === 0) return
    const tween = gsap.fromTo(
      targets,
      { autoAlpha: 0, y },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.5,
        ease: 'power3.out',
        stagger,
        clearProps: 'opacity,visibility,transform',
      },
    )
    return () => {
      tween.kill()
      gsap.set(targets, { clearProps: 'opacity,visibility,transform' })
    }
  }, [ref, key, y, stagger, selector])
}
