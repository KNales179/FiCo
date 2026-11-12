import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { flushSync } from 'react-dom'
import { Link, useLocation, useNavigate, useOutlet } from 'react-router-dom'
import { gsap, prefersReducedMotion } from '../../lib/motion'
import FicoLogo from '../FicoLogo'
import ThemeToggle from '../ThemeToggle'
import AuthShowcase from './AuthShowcase'
import AuthNoticeDialog from './AuthNoticeDialog'
import { AuthNavContext } from './authNav'
import type { AuthNav } from './authNav'

// Left-to-right order of the screens, so moving "forward" (sign in →
// create account) slides one way and going back slides the other.
const ORDER: Record<string, number> = {
  '/forgot-password': 0,
  '/reset-password': 0,
  '/login': 1,
  '/register': 2,
}
const orderOf = (path: string) => ORDER[path] ?? 1

const SHIFT = 28

/**
 * The frame around every sign-in screen: the form on the left, the animated
 * logo panel on the right (wide screens), a gridded backdrop with drifting
 * colour behind both. Moving between screens slides the card out and the
 * next one in, while the card smoothly grows or shrinks to its new height.
 */
const AuthLayout = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const outlet = useOutlet()
  const stageRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const fromHeight = useRef<number | null>(null)
  const direction = useRef<1 | -1>(1)
  const prevPath = useRef(location.pathname)
  const busy = useRef(false)

  const enter = useCallback(() => {
    const stage = stageRef.current
    const inner = innerRef.current
    if (!stage || !inner) return
    const startH = fromHeight.current
    fromHeight.current = null
    busy.current = false
    gsap.killTweensOf([stage, inner])
    const endH = stage.offsetHeight
    if (startH != null && Math.abs(startH - endH) > 1) {
      gsap.fromTo(
        stage,
        { height: startH, overflow: 'hidden' },
        { height: endH, duration: 0.38, ease: 'power2.inOut', clearProps: 'height,overflow' },
      )
    }
    gsap.fromTo(
      inner,
      { x: SHIFT * direction.current, autoAlpha: 0 },
      { x: 0, autoAlpha: 1, duration: 0.4, ease: 'power3.out', clearProps: 'transform,opacity,visibility' },
    )
    const items = inner.querySelectorAll('[data-auth-item]')
    if (items.length) {
      gsap.fromTo(
        items,
        { y: 10, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.35, stagger: 0.035, delay: 0.06, ease: 'power2.out', clearProps: 'transform,opacity,visibility' },
      )
    }
  }, [])

  const leave = useCallback((dir: 1 | -1, then: () => void) => {
    const stage = stageRef.current
    const inner = innerRef.current
    if (!stage || !inner || prefersReducedMotion()) {
      then()
      return
    }
    if (busy.current) return
    busy.current = true
    direction.current = dir
    fromHeight.current = stage.offsetHeight
    gsap.to(inner, {
      x: -SHIFT * dir,
      autoAlpha: 0,
      duration: 0.2,
      ease: 'power2.in',
      onComplete: then,
    })
  }, [])

  const nav = useMemo<AuthNav>(
    () => ({
      go: (to) => {
        if (to === location.pathname) return
        const dir = orderOf(to) >= orderOf(location.pathname) ? 1 : -1
        leave(dir, () => navigate(to))
      },
      swap: (update, dir = 1) => {
        leave(dir, () => {
          flushSync(update)
          if (!prefersReducedMotion()) enter()
        })
      },
    }),
    [enter, leave, location.pathname, navigate],
  )

  // A new screen has rendered — slide it in (also covers browser back/forward).
  useLayoutEffect(() => {
    if (prevPath.current === location.pathname) return
    if (fromHeight.current == null) {
      direction.current = orderOf(location.pathname) >= orderOf(prevPath.current) ? 1 : -1
    }
    prevPath.current = location.pathname
    if (prefersReducedMotion()) {
      busy.current = false
      return
    }
    enter()
  }, [location.pathname, enter])

  // First arrival: the card rises in once.
  useEffect(() => {
    const inner = innerRef.current
    if (!inner || prefersReducedMotion()) return
    const tween = gsap.fromTo(
      inner,
      { y: 18, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.6, delay: 0.1, ease: 'power3.out', clearProps: 'transform,opacity,visibility' },
    )
    return () => {
      tween.kill()
    }
  }, [])

  return (
    <AuthNavContext.Provider value={nav}>
      <AuthNoticeDialog />
      <div className="relative min-h-[100dvh] overflow-x-hidden">
        <div className="auth-backdrop" aria-hidden="true">
          <span className="auth-blob auth-blob-1" />
          <span className="auth-blob auth-blob-2" />
          <span className="auth-blob auth-blob-3" />
        </div>

        <div className="relative mx-auto grid min-h-[100dvh] w-full max-w-7xl gap-8 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:px-8 lg:py-8">
          <section className="flex min-w-0 flex-col">
            <header className="flex items-center justify-between">
              <Link to="/login" className="hidden items-center gap-2 lg:flex" aria-label="Fico">
                <FicoLogo className="h-9 w-9" />
                <span className="text-xl font-extrabold tracking-tight text-ink">Fico</span>
              </Link>
              <span className="lg:hidden" />
              <ThemeToggle />
            </header>

            <div className="flex flex-1 flex-col items-center justify-center py-6 lg:py-10">
              <div className="w-full max-w-md">
                <div className="mb-2 flex flex-col items-center lg:hidden">
                  <AuthShowcase variant="compact" />
                  <span className="text-2xl font-extrabold tracking-tight text-ink md:mt-2 md:text-3xl">Fico</span>
                  <span className="text-sm text-muted">Your Daily Financial Companion</span>
                </div>
                <div ref={stageRef} className="-m-2 p-2">
                  <div ref={innerRef}>{outlet}</div>
                </div>
              </div>
            </div>

            <footer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pb-1 text-xs text-muted lg:justify-start">
              <span>© {new Date().getFullYear()} IBell. All rights reserved.</span>
              <Link to="/terms" className="underline">
                Terms
              </Link>
              <Link to="/privacy" className="underline">
                Privacy
              </Link>
            </footer>
          </section>

          <aside className="sticky top-8 hidden h-[calc(100dvh-4rem)] min-h-[34rem] lg:block">
            <AuthShowcase variant="panel" />
          </aside>
        </div>
      </div>
    </AuthNavContext.Provider>
  )
}

export default AuthLayout
