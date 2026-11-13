import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { gsap, prefersReducedMotion } from '../lib/motion'
import { markNotificationsRead, useNotifications } from '../features/notifications'
import { IconCloudOff, IconMessage, IconShield } from './icons'

/**
 * A message from the admin team (or news about your account) pops up the
 * next time you open Fico, one at a time. "Got it" marks it read; it stays
 * on the Notifications page either way.
 */
const NoticePopup = () => {
  const { items } = useNotifications()
  const location = useLocation()
  const navigate = useNavigate()
  const cardRef = useRef<HTMLDivElement>(null)

  const notice = location.pathname === '/notifications' ? undefined : items.find((n) => n.popup && !n.readAt)

  useEffect(() => {
    const el = cardRef.current
    if (!notice || !el || prefersReducedMotion()) return
    const tween = gsap.fromTo(
      el,
      { y: 30, scale: 0.95, autoAlpha: 0 },
      { y: 0, scale: 1, autoAlpha: 1, duration: 0.45, ease: 'back.out(1.6)', clearProps: 'transform,opacity,visibility' },
    )
    return () => {
      tween.kill()
    }
  }, [notice?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!notice) return null
  const sync = notice.kind === 'SYNC_REJECTED' || notice.kind === 'SYNC_OVERWRITTEN'
  const Icon = sync ? IconCloudOff : notice.kind === 'ADMIN_ACTION' ? IconShield : IconMessage
  const eyebrow =
    notice.kind === 'SYNC_REJECTED'
      ? 'Sync problem'
      : notice.kind === 'SYNC_OVERWRITTEN'
        ? 'Your edit was replaced'
        : notice.kind === 'ADMIN_ACTION'
          ? 'About your account'
          : 'You have a message'
  const done = () => void markNotificationsRead([notice.id])

  return (
    <div className="fixed inset-0 z-[45] flex items-end justify-center bg-black/50 p-3 sm:items-center sm:p-6">
      <button type="button" aria-label="Close" className="fixed inset-0 cursor-default" onClick={done} />
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notice-title"
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-line bg-panel shadow-2xl"
      >
        <div className="hero-card rounded-none border-0 border-b border-line">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-brand-ink">
              <Icon size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand">
                {eyebrow}
              </p>
              <h2 id="notice-title" className="text-lg font-bold leading-tight text-ink">
                {notice.title}
              </h2>
            </div>
          </div>
        </div>
        <div className="max-h-[50dvh] overflow-y-auto px-5 py-4">
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{notice.body}</p>
          {notice.sections && notice.sections.length > 0 && (
            <div className="mt-3 space-y-2">
              {notice.sections.slice(0, 3).map((section, i) => (
                <div key={i} className="rounded-xl border border-line bg-panel-2 px-3 py-2">
                  <p className="text-sm font-semibold text-ink">{section.heading}</p>
                  <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-xs">
                    {section.lines.map((line, j) => (
                      <div key={j} className="contents">
                        <dt className="text-muted">{line.label}</dt>
                        <dd className="break-words text-ink">{line.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
              {notice.sections.length > 3 && (
                <p className="text-xs text-muted">+{notice.sections.length - 3} more — see all in Notifications.</p>
              )}
            </div>
          )}
          {notice.senderName && <p className="mt-3 text-xs text-muted">— {notice.senderName}</p>}
        </div>
        <div className="flex gap-2 border-t border-line px-5 py-3">
          <button
            type="button"
            className="btn flex-1"
            onClick={() => {
              done()
              navigate('/notifications')
            }}
          >
            All notifications
          </button>
          <button type="button" className="btn btn-primary flex-1" onClick={done} autoFocus>
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}

export default NoticePopup
