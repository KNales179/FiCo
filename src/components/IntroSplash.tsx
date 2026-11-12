import { useEffect, useId, useRef, useState } from 'react'
import { gsap, prefersReducedMotion } from '../lib/motion'
import {
  LEAF_GRADIENT,
  LETTERS_GRADIENT,
  LOGO_C_BOTTOM,
  LOGO_C_TOP,
  LOGO_F,
  LOGO_LEAF,
  LOGO_VIEWBOX,
} from './ficoLogoPaths'

const SESSION_KEY = 'fico.introPlayed'

/** Once per app open: a fresh launch or a new tab, not every reload or page change. */
const shouldPlay = () => {
  if (prefersReducedMotion()) return false
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return false
    sessionStorage.setItem(SESSION_KEY, '1')
    return true
  } catch {
    return false
  }
}

/**
 * The opening "Draw & fill" sequence: a pen traces each piece of the logo,
 * the colour pours in, "Fico" rises underneath, then the splash closes in a
 * circle onto the leaf to reveal the app — which has been loading beneath it
 * the whole time. About 2½ seconds; a tap anywhere skips it.
 *
 * Colours follow the same --logo-* tokens as the header logo (the colour
 * chosen in Settings), and the background follows light / dark — the
 * phone's own setting, unless a theme was picked in Fico.
 */
const IntroSplash = () => {
  const [show, setShow] = useState(shouldPlay)
  const rootRef = useRef<HTMLDivElement>(null)
  const tlRef = useRef<ReturnType<typeof gsap.timeline> | null>(null)
  const id = useId().replace(/:/g, '')

  useEffect(() => {
    const root = rootRef.current
    if (!show || !root) return
    const pieces = Array.from(root.querySelectorAll<SVGPathElement>('[data-piece]'))
    const letters = pieces.filter((p) => p.dataset.piece !== 'leaf')
    const leaf = pieces.filter((p) => p.dataset.piece === 'leaf')
    const word = root.querySelectorAll('[data-word] > span')
    const tag = root.querySelector('[data-tag]')
    const glow = root.querySelector('[data-glow]')

    const tl = gsap.timeline({ onComplete: () => setShow(false) })
    pieces.forEach((p) => {
      const len = p.getTotalLength()
      gsap.set(p, { strokeDasharray: len, strokeDashoffset: len, fillOpacity: 0, strokeWidth: 6 })
    })
    gsap.set([word, tag], { autoAlpha: 0, y: 10 })
    gsap.set(glow, { autoAlpha: 0, scale: 0.6 })

    tl.to(glow, { autoAlpha: 1, scale: 1, duration: 0.9, ease: 'sine.out' }, 0)
      .to(pieces, { strokeDashoffset: 0, duration: 1.0, ease: 'power1.inOut', stagger: 0.1 }, 0.05)
      .to(letters, { fillOpacity: 1, duration: 0.45, ease: 'power1.out' }, 0.95)
      .to(leaf, { fillOpacity: 1, duration: 0.4 }, 1.15)
      .to(pieces, { strokeWidth: 0, duration: 0.35 }, 1.25)
      .to(word, { autoAlpha: 1, y: 0, stagger: 0.05, duration: 0.35, ease: 'power3.out' }, 1.2)
      .to(tag, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power3.out' }, 1.45)
      .to(root, { clipPath: 'circle(0% at 50% 45%)', duration: 0.6, ease: 'power2.in' }, 2.0)
    tlRef.current = tl
    return () => {
      tl.kill()
    }
  }, [show])

  if (!show) return null

  // Tapping anywhere jumps straight to the closing circle.
  const skip = () => {
    const tl = tlRef.current
    if (tl && tl.time() < 2.0) tl.seek(2.0)
  }

  return (
    <div
      ref={rootRef}
      data-intro-splash=""
      onClick={skip}
      role="presentation"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3"
      style={{
        clipPath: 'circle(150% at 50% 45%)',
        background:
          'radial-gradient(120% 70% at 50% 42%, color-mix(in srgb, var(--brand) 16%, var(--surface-base)), var(--surface-base) 70%)',
      }}
    >
      <div
        data-glow=""
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[42%] aspect-square w-[min(70vw,22rem)] -translate-x-1/2 -translate-y-1/2 rounded-full blur-md"
        style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--brand) 40%, transparent), transparent 65%)' }}
      />
      <svg viewBox={LOGO_VIEWBOX} className="relative h-auto w-[min(38vw,11rem)] overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id={`intro-letters-${id}`} gradientUnits="userSpaceOnUse" {...LETTERS_GRADIENT}>
            <stop offset="0" style={{ stopColor: 'var(--logo-from)' }} />
            <stop offset="1" style={{ stopColor: 'var(--logo-to)' }} />
          </linearGradient>
          <linearGradient id={`intro-leaf-${id}`} gradientUnits="userSpaceOnUse" {...LEAF_GRADIENT}>
            <stop offset="0" style={{ stopColor: 'var(--logo-leaf-from)' }} />
            <stop offset="1" style={{ stopColor: 'var(--logo-leaf-to)' }} />
          </linearGradient>
        </defs>
        {[LOGO_F, LOGO_C_TOP, LOGO_C_BOTTOM].map((d, i) => (
          <path key={i} data-piece="letter" d={d} fill={`url(#intro-letters-${id})`} style={{ stroke: 'var(--logo-to)' }} />
        ))}
        <path data-piece="leaf" d={LOGO_LEAF} fill={`url(#intro-leaf-${id})`} style={{ stroke: 'var(--logo-leaf-from)' }} />
      </svg>
      <div data-word="" className="relative flex text-3xl font-extrabold tracking-tight text-ink" aria-label="Fico">
        {'Fico'.split('').map((c, i) => (
          <span key={i} aria-hidden="true" className="inline-block">
            {c}
          </span>
        ))}
      </div>
      <p data-tag="" className="relative text-sm text-muted">
        Your Daily Financial Companion
      </p>
    </div>
  )
}

export default IntroSplash
