import { useEffect, useId, useRef, useState } from 'react'
import { gsap, prefersReducedMotion } from '../../lib/motion'
import {
  LEAF_GRADIENT,
  LETTERS_GRADIENT,
  LOGO_C_BOTTOM,
  LOGO_C_TOP,
  LOGO_F,
  LOGO_LEAF,
  LOGO_VIEWBOX,
} from '../ficoLogoPaths'
import { IconCalendar, IconChart, IconUsers, IconWallet } from '../icons'

const TAGLINES = [
  'Every peso, in its place.',
  'Bills on time. Budgets that hold.',
  'One household, one shared picture.',
  'Works offline — your records go where you go.',
]

// Where the leaf's stem meets the C, in logo coordinates — the leaf sways
// from here like it's attached.
const LEAF_PIVOT = '560 690'

/**
 * The sign-in screen's logo, alive: the "Draw & fill" intro, then an idle
 * stretch (a gentle float, the leaf swaying, a light sweeping across, the
 * glow breathing), then an outro where it un-draws itself — and round again,
 * one seamless loop. `panel` is the big side panel on wide screens (with
 * taglines and floating sample cards); `compact` is the small one above the
 * form on phones. Reduced motion → a still logo.
 */
const AuthShowcase = ({ variant }: { variant: 'panel' | 'compact' }) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const id = useId().replace(/:/g, '')
  const [tagline, setTagline] = useState(0)
  const panel = variant === 'panel'

  useEffect(() => {
    const root = rootRef.current
    if (!root || prefersReducedMotion()) return

    const ctx = gsap.context(() => {
      const pieces = Array.from(root.querySelectorAll<SVGPathElement>('[data-piece]'))
      const letters = pieces.filter((p) => p.dataset.piece !== 'leaf')
      const leaf = pieces.filter((p) => p.dataset.piece === 'leaf')
      const mark = root.querySelector('[data-mark]')
      const leafGroup = root.querySelector('[data-leaf]')
      const shine = root.querySelector('[data-shine]')
      const glow = root.querySelector('[data-glow]')
      const tag = root.querySelector('[data-tagline]')
      const lengths = pieces.map((p) => p.getTotalLength())

      const reset = () => {
        pieces.forEach((p, i) =>
          gsap.set(p, { strokeDasharray: lengths[i], strokeDashoffset: lengths[i], fillOpacity: 0, strokeWidth: 7 }),
        )
        gsap.set(mark, { scale: 0.94, y: 0, svgOrigin: '630 606' })
        gsap.set(leafGroup, { rotation: 0, svgOrigin: LEAF_PIVOT })
        gsap.set(shine, { x: -520 })
        gsap.set(glow, { autoAlpha: 0, scale: 0.7 })
        if (tag) gsap.set(tag, { autoAlpha: 0, y: 12 })
      }
      reset()

      const IDLE = 1.9 // idle starts
      const OUTRO = 8.2 // outro starts

      const tl = gsap.timeline({
        repeat: -1,
        repeatDelay: 0.35,
        onRepeat: () => {
          reset()
          setTagline((t) => (t + 1) % TAGLINES.length)
        },
      })

      // ── Intro: draw & fill ──────────────────────────────────────────
      tl.to(glow, { autoAlpha: 1, scale: 1, duration: 1, ease: 'sine.out' }, 0)
        .to(pieces, { strokeDashoffset: 0, duration: 1.05, ease: 'power1.inOut', stagger: 0.1 }, 0.05)
        .to(letters, { fillOpacity: 1, duration: 0.5, ease: 'power1.out' }, 0.95)
        .to(leaf, { fillOpacity: 1, duration: 0.45 }, 1.15)
        .to(pieces, { strokeWidth: 0, duration: 0.4 }, 1.3)
        .to(mark, { scale: 1, duration: 0.9, ease: 'back.out(1.6)' }, 1.0)
      if (tag) tl.to(tag, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 1.4)

      // ── Idle: float, sway, shimmer, breathe ─────────────────────────
      tl.to(mark, { y: -12, duration: 1.55, ease: 'sine.inOut', yoyo: true, repeat: 3 }, IDLE)
        .to(leafGroup, { rotation: -7, duration: 0.95, ease: 'sine.inOut', yoyo: true, repeat: 5 }, IDLE + 0.2)
        .to(glow, { scale: 1.12, autoAlpha: 0.7, duration: 1.55, ease: 'sine.inOut', yoyo: true, repeat: 3 }, IDLE)
        .to(shine, { x: 520, duration: 1.1, ease: 'power2.inOut' }, IDLE + 0.6)
        .set(shine, { x: -520 }, IDLE + 1.8)
        .to(shine, { x: 520, duration: 1.1, ease: 'power2.inOut' }, IDLE + 3.7)

      // ── Outro: un-draw ──────────────────────────────────────────────
      if (tag) tl.to(tag, { autoAlpha: 0, y: -10, duration: 0.4, ease: 'power2.in' }, OUTRO - 0.2)
      tl.to(pieces, { strokeWidth: 7, duration: 0.3 }, OUTRO)
        .to(pieces, { fillOpacity: 0, duration: 0.45, ease: 'power1.in' }, OUTRO + 0.1)
        .to(
          pieces,
          {
            strokeDashoffset: (i: number) => -lengths[i],
            duration: 0.9,
            ease: 'power1.inOut',
            stagger: 0.08,
          },
          OUTRO + 0.25,
        )
        .to(mark, { scale: 0.94, duration: 0.9, ease: 'power2.in' }, OUTRO + 0.2)
        .to(glow, { autoAlpha: 0, scale: 0.7, duration: 0.8, ease: 'sine.in' }, OUTRO + 0.4)
    }, root)

    return () => ctx.revert()
  }, [])

  const logo = (
    <svg
      viewBox={LOGO_VIEWBOX}
      className={panel ? 'relative h-auto w-[min(17rem,60%,40cqh)] overflow-visible' : 'relative h-20 w-20 overflow-visible md:h-32 md:w-32'}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`sc-letters-${id}`} gradientUnits="userSpaceOnUse" {...LETTERS_GRADIENT}>
          <stop offset="0" style={{ stopColor: 'var(--logo-from)' }} />
          <stop offset="1" style={{ stopColor: 'var(--logo-to)' }} />
        </linearGradient>
        <linearGradient id={`sc-leaf-${id}`} gradientUnits="userSpaceOnUse" {...LEAF_GRADIENT}>
          <stop offset="0" style={{ stopColor: 'var(--logo-leaf-from)' }} />
          <stop offset="1" style={{ stopColor: 'var(--logo-leaf-to)' }} />
        </linearGradient>
        <linearGradient id={`sc-shine-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`sc-clip-${id}`}>
          <path d={LOGO_F} />
          <path d={LOGO_C_TOP} />
          <path d={LOGO_C_BOTTOM} />
          <path d={LOGO_LEAF} />
        </clipPath>
      </defs>
      <g data-mark="">
        {[LOGO_F, LOGO_C_TOP, LOGO_C_BOTTOM].map((d, i) => (
          <path key={i} data-piece="letter" d={d} fill={`url(#sc-letters-${id})`} style={{ stroke: 'var(--logo-to)' }} />
        ))}
        <g data-leaf="">
          <path data-piece="leaf" d={LOGO_LEAF} fill={`url(#sc-leaf-${id})`} style={{ stroke: 'var(--logo-leaf-from)' }} />
        </g>
        <g clipPath={`url(#sc-clip-${id})`}>
          <rect data-shine="" x="460" y="300" width="170" height="620" fill={`url(#sc-shine-${id})`} transform="skewX(-18)" />
        </g>
      </g>
    </svg>
  )

  const glow = (
    <div
      data-glow=""
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-1/2 aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full blur-xl"
      style={{
        width: panel ? 'min(30rem, 90%)' : '9rem',
        background: 'radial-gradient(circle, color-mix(in srgb, var(--brand) 38%, transparent), transparent 66%)',
      }}
    />
  )

  if (!panel) {
    return (
      <div ref={rootRef} className="relative flex items-center justify-center py-2">
        {glow}
        {logo}
      </div>
    )
  }

  return (
    <div ref={rootRef} className="auth-panel relative flex h-full flex-col overflow-hidden rounded-[2rem] border border-line">
      <div className="auth-panel-grid" aria-hidden="true" />
      <div className="auth-orbit auth-orbit-1" aria-hidden="true" />
      <div className="auth-orbit auth-orbit-2" aria-hidden="true" />

      <div className="relative flex flex-1 flex-col items-center justify-center px-8">
        <div className="relative flex w-full items-center justify-center">
          {glow}
          {logo}
        </div>
        <p className="mt-6 text-4xl font-extrabold tracking-tight text-ink">Fico</p>
        <p data-tagline="" aria-live="off" className="relative z-10 mt-2 min-h-[1.75rem] text-center text-lg text-muted">
          {TAGLINES[tagline]}
        </p>
      </div>

      {/* Sample cards floating around the logo — what's waiting inside. */}
      <div className="auth-chip auth-chip-tl left-[7%] top-[12%]" style={{ animationDelay: '0s' }} aria-hidden="true">
        <span className="auth-chip-icon text-success">
          <IconWallet size={16} />
        </span>
        <span>
          <span className="block text-[11px] text-muted">Salary</span>
          <span className="block font-semibold text-success">+₱25,000</span>
        </span>
      </div>
      <div className="auth-chip auth-chip-tr right-[7%] top-[16%]" style={{ animationDelay: '-2.2s' }} aria-hidden="true">
        <span className="auth-chip-icon text-brand">
          <IconCalendar size={16} />
        </span>
        <span>
          <span className="block text-[11px] text-muted">Electric bill</span>
          <span className="block font-semibold text-ink">Paid · on time</span>
        </span>
      </div>
      <div className="auth-chip auth-chip-low bottom-[11%] left-[7%]" style={{ animationDelay: '-4.1s' }} aria-hidden="true">
        <span className="auth-chip-icon text-brand">
          <IconChart size={16} />
        </span>
        <span className="w-28">
          <span className="block text-[11px] text-muted">Groceries budget</span>
          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-panel-2">
            <span className="block h-full w-[68%] rounded-full bg-brand" />
          </span>
        </span>
      </div>
      <div className="auth-chip auth-chip-household bottom-[17%] right-[7%]" style={{ animationDelay: '-1.3s' }} aria-hidden="true">
        <span className="auth-chip-icon text-brand">
          <IconUsers size={16} />
        </span>
        <span>
          <span className="block text-[11px] text-muted">Household</span>
          <span className="block font-semibold text-ink">3 members</span>
        </span>
      </div>

      <p className="relative px-8 pb-6 text-center text-xs text-muted">
        Personal & family finance — typed in by you, kept on your device, synced when you're online.
      </p>
    </div>
  )
}

export default AuthShowcase
