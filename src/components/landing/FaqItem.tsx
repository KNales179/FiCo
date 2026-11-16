import { useId, useRef, useState, type ReactNode } from 'react'
import { gsap, prefersReducedMotion } from '../../lib/motion'
import { IconChevronDown } from '../icons'

/**
 * One FAQ question. Opens fast, then settles gently (the same feel as the
 * app's cards), and closes quickly. The answer's height is animated, so
 * nothing below it jumps.
 */
const FaqItem = ({ q, children }: { q: string; children: ReactNode }) => {
  const [open, setOpen] = useState(false)
  const body = useRef<HTMLDivElement>(null)
  const id = useId()

  const toggle = () => {
    const el = body.current
    const next = !open
    if (!el || prefersReducedMotion()) {
      setOpen(next)
      return
    }
    gsap.killTweensOf(el)
    if (next) {
      setOpen(true)
      // Measure once it's in the page, then grow to that height.
      requestAnimationFrame(() => {
        gsap.fromTo(
          el,
          { height: 0, autoAlpha: 0 },
          { height: 'auto', autoAlpha: 1, duration: 0.55, ease: 'expo.out', clearProps: 'height,opacity,visibility' },
        )
      })
    } else {
      gsap.to(el, {
        height: 0,
        autoAlpha: 0,
        duration: 0.28,
        ease: 'power3.out',
        onComplete: () => {
          setOpen(false)
          gsap.set(el, { clearProps: 'height,opacity,visibility' })
        },
      })
    }
  }

  return (
    <div className="card hover-card p-0 sm:p-0">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={id}
        data-tag={open ? 'Hide the answer' : 'Show the answer'}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left font-semibold text-ink"
      >
        {q}
        <IconChevronDown
          size={18}
          className={`shrink-0 text-muted transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div ref={body} id={id} hidden={!open} className="overflow-hidden">
        <div className="px-5 pb-4 text-sm text-muted">{children}</div>
      </div>
    </div>
  )
}

export default FaqItem
