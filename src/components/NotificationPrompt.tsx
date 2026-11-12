import { useEffect, useRef, useState } from 'react'
import { enablePush, getCurrentPushSubscription, isPushSupported } from '../features/push'
import { ensureDeviceId } from '../features/auth/localAuth'
import { hasSeenTutorial } from '../features/onboarding'
import { seenVersion, APP_VERSION } from '../features/whatsNew/changelog'
import { useTour } from '../hooks/useTour'
import { gsap, prefersReducedMotion } from '../lib/motion'
import { IconBell, IconX } from './icons'

const SNOOZE_KEY = 'fico.pushPromptAt'
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000
const DELAY_MS = 20 * 1000

const snoozedRecently = () => {
  try {
    const at = Number(localStorage.getItem(SNOOZE_KEY) || 0)
    return Date.now() - at < SNOOZE_MS
  } catch {
    return true
  }
}

const snooze = () => {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now()))
  } catch {
    // ignore
  }
}

/**
 * A small card (not a blocking dialog) that slides in now and then to offer
 * push notifications — they used to live only on the Account page, which
 * hardly anyone found. Never shown if notifications are already on, if the
 * browser has them blocked, during a tour, or while the welcome / what's-new
 * pop-ups are up; "Not now" waits a week before asking again.
 */
const NotificationPrompt = () => {
  const { running: tourRunning } = useTour()
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isPushSupported() || Notification.permission === 'denied' || snoozedRecently()) return
    const timer = window.setTimeout(async () => {
      // Let the first-run and what's-new pop-ups have the stage first.
      if (!hasSeenTutorial() || seenVersion() !== APP_VERSION) return
      if (!navigator.onLine) return
      const subscription = await getCurrentPushSubscription().catch(() => null)
      if (!subscription) setShow(true)
    }, DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const el = cardRef.current
    if (!show || !el || prefersReducedMotion()) return
    const tween = gsap.from(el, { autoAlpha: 0, y: 30, duration: 0.45, ease: 'back.out(1.6)' })
    return () => {
      tween.kill()
    }
  }, [show])

  const hide = (after?: () => void) => {
    const el = cardRef.current
    if (!el || prefersReducedMotion()) {
      setShow(false)
      after?.()
      return
    }
    gsap.to(el, {
      autoAlpha: 0,
      y: 20,
      duration: 0.25,
      onComplete: () => {
        setShow(false)
        after?.()
      },
    })
  }

  const turnOn = async () => {
    setBusy(true)
    setMessage('')
    try {
      const deviceId = await ensureDeviceId().catch(() => undefined)
      const result = await enablePush(deviceId)
      if (result.ok) {
        setMessage('Done — you’ll get bill reminders on this device.')
        window.setTimeout(() => hide(), 1600)
      } else {
        snooze()
        setMessage(
          result.reason === 'permission-denied'
            ? 'Notifications are blocked for Fico in your browser settings.'
            : result.reason === 'not-configured'
              ? 'The server isn’t ready for notifications yet — try again later from your Account page.'
              : 'This browser can’t do push notifications.',
        )
      }
    } catch {
      setMessage('Couldn’t reach the server — try again once you’re online.')
    } finally {
      setBusy(false)
    }
  }

  if (!show || tourRunning) return null

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-labelledby="push-prompt-title"
      className="fixed inset-x-3 bottom-24 z-30 mx-auto max-w-sm rounded-2xl border border-line bg-panel p-4 shadow-2xl sm:inset-x-auto sm:right-5 lg:bottom-5"
    >
      <button
        type="button"
        onClick={() => {
          snooze()
          hide()
        }}
        aria-label="Not now"
        className="absolute right-2.5 top-2.5 rounded-md p-1 text-muted hover:bg-panel-2 hover:text-ink"
      >
        <IconX size={16} />
      </button>
      <div className="flex gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-ink">
          <IconBell size={19} />
        </span>
        <div className="min-w-0 pr-5">
          <p id="push-prompt-title" className="text-sm font-semibold text-ink">
            Never miss a bill?
          </p>
          <p className="mt-0.5 text-sm text-muted">
            Turn on notifications for bill reminders and when someone in your Finance adds or pays something.
          </p>
          {message && <p className="mt-2 text-xs font-medium text-ink">{message}</p>}
          {!message && (
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => void turnOn()} disabled={busy} className="btn btn-primary btn-sm">
                {busy ? 'Turning on…' : 'Turn on'}
              </button>
              <button
                type="button"
                onClick={() => {
                  snooze()
                  hide()
                }}
                className="btn btn-ghost btn-sm"
              >
                Not now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default NotificationPrompt
