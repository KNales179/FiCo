import { useCallback, useEffect, useRef, useState } from 'react'
import { hasSeenTutorial } from '../features/onboarding'
import {
  CURRENT_RELEASE,
  markVersionSeen,
  unseenReleases,
  type Release,
} from '../features/whatsNew/changelog'
import { gsap, prefersReducedMotion } from '../lib/motion'
import { IconX } from './icons'
import { RELEASE_ICONS as ICONS } from './releaseIcons'


/**
 * "What's new" — shown once per device after an update, describing the
 * whole release (features/whatsNew/changelog.ts). A brand-new device gets
 * the welcome prompt instead, and simply starts on the current version.
 */
const WhatsNewModal = () => {
  const [releases, setReleases] = useState<Release[]>([])
  const show = releases.length > 0
  const panelRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => {
    markVersionSeen()
    setReleases([])
  }, [])

  useEffect(() => {
    const missed = unseenReleases()
    if (missed.length === 0) return
    if (!hasSeenTutorial()) {
      // First time on this device — the welcome prompt covers it.
      markVersionSeen()
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReleases(missed)
  }, [])

  useEffect(() => {
    const el = panelRef.current
    if (!show || !el || prefersReducedMotion()) return
    const tl = gsap.timeline()
    tl.from(el, { autoAlpha: 0, y: 24, scale: 0.97, duration: 0.4, ease: 'power3.out' }).from(
      el.querySelectorAll('[data-highlight]'),
      { autoAlpha: 0, y: 10, duration: 0.35, ease: 'power2.out', stagger: 0.05, clearProps: 'all' },
      '-=0.15',
    )
    return () => {
      tl.kill()
    }
  }, [show])

  useEffect(() => {
    if (!show) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [show, close])

  if (!show) return null

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-3 sm:items-center sm:p-6">
      <button type="button" aria-label="Close" className="fixed inset-0 cursor-default" onClick={close} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        className="relative flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl"
      >
        <div className="hero-card rounded-none border-0 border-b border-line">
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-3 top-3 rounded-md p-1 text-muted hover:bg-panel-2 hover:text-ink"
          >
            <IconX size={18} />
          </button>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">
            What's new · v{CURRENT_RELEASE.version}
            {releases.length > 1 &&
              ` + ${releases.length - 1} earlier update${releases.length > 2 ? 's' : ''}`}
          </p>
          <h2 id="whats-new-title" className="mt-1 text-2xl font-bold text-ink">
            {CURRENT_RELEASE.title}
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            {new Date(`${CURRENT_RELEASE.date}T00:00:00`).toLocaleDateString(undefined, {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>

        {/* One pop-up for everything missed: each release under its own
            version heading, newest first. */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {releases.map((release, i) => (
            <section key={release.version}>
              {releases.length > 1 && (
                <p data-highlight="" className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
                  <span className="rounded-md bg-brand/10 px-1.5 py-0.5 text-brand">v{release.version}</span>
                  {i === 0 ? 'Latest' : release.title}
                </p>
              )}
              <ul className="space-y-3">
                {release.highlights.map((h) => {
                  const Icon = ICONS[h.icon]
                  return (
                    <li key={h.title} data-highlight="" className="flex gap-3">
                      <span className="card-icon mt-0.5">
                        <Icon size={16} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">{h.title}</p>
                        <p className="mt-0.5 text-sm leading-relaxed text-muted">{h.body}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>

        <div className="border-t border-line px-5 py-3">
          <button type="button" onClick={close} className="btn btn-primary w-full py-2">
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}

export default WhatsNewModal
