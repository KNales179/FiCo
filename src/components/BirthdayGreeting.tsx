import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { birthdayGreeting, isBirthdayToday } from '../features/profile'
import { gsap, prefersReducedMotion } from '../lib/motion'
import FicoLogo from './FicoLogo'

const KEY = 'fico.birthdayGreeted'

const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

const alreadyGreeted = () => {
  try {
    return localStorage.getItem(KEY) === todayKey()
  } catch {
    return false
  }
}

const CONFETTI_COLORS = ['var(--brand)', 'var(--warning)', 'var(--success)', 'var(--logo-leaf-to)', 'var(--danger)']

/**
 * On the person's birthday (from Account → About you), the first time they
 * open Fico that day: a greeting with a burst of confetti. Once per day per
 * device, works offline (the birthday is cached with the account), and
 * waits for the opening animation to finish first. Sits above the "What's
 * new" pop-up, which is simply there underneath when this is closed.
 */
const BirthdayGreeting = () => {
  const { user } = useAuth()
  const [show, setShow] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const birthday = user?.birthday
  useEffect(() => {
    if (!birthday || !isBirthdayToday(birthday) || alreadyGreeted()) return
    // Wait for the intro splash (if it's playing) to finish.
    let timer = 0
    const check = () => {
      if (document.querySelector('[data-intro-splash]')) timer = window.setTimeout(check, 300)
      else timer = window.setTimeout(() => setShow(true), 500)
    }
    check()
    return () => window.clearTimeout(timer)
  }, [birthday])

  const close = useCallback(() => {
    try {
      localStorage.setItem(KEY, todayKey())
    } catch {
      // Then it may greet again on the next open today — harmless.
    }
    const root = rootRef.current
    if (!root || prefersReducedMotion()) {
      setShow(false)
      return
    }
    gsap.to(root, { autoAlpha: 0, duration: 0.25, onComplete: () => setShow(false) })
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!show || !root) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    if (prefersReducedMotion()) return () => document.removeEventListener('keydown', onKey)

    const ctx = gsap.context(() => {
      const card = root.querySelector('[data-card]')
      const bits = root.querySelectorAll<HTMLElement>('[data-bit]')
      // fromTo with explicit end values — a CSS transition on the button
      // would otherwise make `from` read a half-faded value as its target.
      gsap.fromTo(root, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 })
      gsap.fromTo(
        card,
        { y: 40, scale: 0.9, autoAlpha: 0 },
        { y: 0, scale: 1, autoAlpha: 1, duration: 0.6, ease: 'back.out(1.7)', delay: 0.1 },
      )
      gsap.fromTo(
        root.querySelectorAll('[data-line]'),
        { y: 12, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, stagger: 0.08, duration: 0.4, ease: 'power2.out', delay: 0.35, clearProps: 'transform,opacity,visibility' },
      )
      // Confetti: burst up from behind the card, then flutter down.
      bits.forEach((bit) => {
        const x = gsap.utils.random(-window.innerWidth * 0.55, window.innerWidth * 0.55)
        const peak = gsap.utils.random(-window.innerHeight * 0.55, -window.innerHeight * 0.2)
        gsap
          .timeline({ delay: gsap.utils.random(0.1, 0.35) })
          .fromTo(
            bit,
            { x: 0, y: 0, rotation: 0, autoAlpha: 1 },
            { x: x * 0.6, y: peak, rotation: gsap.utils.random(-360, 360), duration: 0.7, ease: 'power2.out' },
          )
          .to(bit, {
            x,
            y: window.innerHeight * 0.7,
            rotation: `+=${gsap.utils.random(-540, 540)}`,
            duration: gsap.utils.random(2.2, 3.4),
            ease: 'sine.in',
          })
          .to(bit, { autoAlpha: 0, duration: 0.4 }, '-=0.4')
      })
    }, root)
    return () => {
      document.removeEventListener('keydown', onKey)
      ctx.revert()
    }
  }, [show, close])

  if (!show || !user?.birthday) return null

  const name = user.displayName?.split(' ')[0] || user.username
  const { title, body } = birthdayGreeting({ birthday: user.birthday, name })

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/55 p-4"
    >
      <button type="button" aria-label="Close" className="fixed inset-0 cursor-default" onClick={close} />
      <div className="pointer-events-none absolute left-1/2 top-1/2" aria-hidden="true">
        {Array.from({ length: 48 }, (_, i) => (
          <span
            key={i}
            data-bit=""
            className="absolute block opacity-0"
            style={{
              width: i % 3 === 0 ? 8 : 6,
              height: i % 3 === 0 ? 8 : 12,
              borderRadius: i % 3 === 0 ? 9999 : 2,
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            }}
          />
        ))}
      </div>
      <div
        data-card=""
        role="dialog"
        aria-modal="true"
        aria-labelledby="birthday-title"
        className="birthday-card relative w-full max-w-sm rounded-3xl border border-line px-6 pb-6 pt-8 text-center shadow-2xl"
      >
        <span className="birthday-confetti" aria-hidden="true" />
        <div data-line="" className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-panel shadow-lg ring-4 ring-brand/20">
          <FicoLogo className="h-12 w-12" />
        </div>
        <p data-line="" className="relative text-xs font-semibold uppercase tracking-[0.2em] text-brand">
          Today’s your day
        </p>
        <h2 id="birthday-title" data-line="" className="relative mt-1 text-2xl font-extrabold tracking-tight text-ink">
          {title}
        </h2>
        <p data-line="" className="relative mt-3 text-sm leading-relaxed text-muted">
          {body}
        </p>
        <p data-line="" className="relative mt-3 text-xs text-muted">— with love, Fico</p>
        <button data-line="" type="button" onClick={close} autoFocus className="btn btn-primary relative mt-5 w-full py-2.5">
          Thank you, Fico!
        </button>
      </div>
    </div>
  )
}

export default BirthdayGreeting
