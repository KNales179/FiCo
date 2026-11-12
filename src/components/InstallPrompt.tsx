import { useEffect, useRef, useState } from 'react'
import {
  installPlatform,
  isRunningInstalled,
  onInstallAvailabilityChange,
  promptInstall,
} from '../features/pwa/installPrompt'
import { detectBrowser, installGuideFor } from '../features/pwa/installGuide'
import { hasSeenTutorial } from '../features/onboarding'
import { APP_VERSION, seenVersion } from '../features/whatsNew/changelog'
import { useTour } from '../hooks/useTour'
import { claimPromptSlot } from '../lib/promptSlot'
import { gsap, prefersReducedMotion } from '../lib/motion'
import { IconDownload, IconX } from './icons'

const SNOOZE_KEY = 'fico.installPromptAt'
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000
const DELAY_MS = 8 * 1000

const snoozed = () => {
  try {
    return Date.now() - Number(localStorage.getItem(SNOOZE_KEY) || 0) < SNOOZE_MS
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
 * "Install Fico" — a small card that slides in so nobody has to dig through
 * the browser's menu. Where the browser allows it (Chrome, Edge, Samsung
 * Internet…), one tap opens the browser's own "Install Fico?" box. On an
 * iPhone or iPad (no such button allowed) it shows the two Share-menu
 * steps instead. Never shown when Fico is already installed, during a
 * tour, or alongside another pop-up; "Not now" waits two weeks.
 */
const InstallPrompt = () => {
  const { running: tourRunning } = useTour()
  const [mode, setMode] = useState<'one-tap' | 'ios' | null>(null)
  const [busy, setBusy] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isRunningInstalled() || snoozed()) return
    const tryShow = () => {
      if (!hasSeenTutorial() || seenVersion() !== APP_VERSION) return
      const platform = installPlatform()
      const next = platform === 'promptable' ? 'one-tap' : detectBrowser() === 'ios' ? 'ios' : null
      if (next && claimPromptSlot()) setMode(next)
    }
    const timer = window.setTimeout(tryShow, DELAY_MS)
    // Chrome can announce "installable" a little after load.
    const off = onInstallAvailabilityChange(() => {
      if (installPlatform() !== 'promptable') setMode(null)
    })
    return () => {
      window.clearTimeout(timer)
      off()
    }
  }, [])

  useEffect(() => {
    const el = cardRef.current
    if (!mode || !el || prefersReducedMotion()) return
    const tween = gsap.from(el, { autoAlpha: 0, y: 30, duration: 0.45, ease: 'back.out(1.6)' })
    return () => {
      tween.kill()
    }
  }, [mode])

  const close = (remember = true) => {
    if (remember) snooze()
    const el = cardRef.current
    if (!el || prefersReducedMotion()) return setMode(null)
    gsap.to(el, { autoAlpha: 0, y: 20, duration: 0.25, onComplete: () => setMode(null) })
  }

  const install = async () => {
    setBusy(true)
    try {
      const accepted = await promptInstall()
      close(!accepted)
    } finally {
      setBusy(false)
    }
  }

  if (!mode || tourRunning) return null
  const ios = installGuideFor('ios')

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-labelledby="install-prompt-title"
      className="fixed inset-x-3 bottom-24 z-30 mx-auto max-w-sm rounded-2xl border border-line bg-panel p-4 shadow-2xl sm:inset-x-auto sm:right-5 lg:bottom-5"
    >
      <button
        type="button"
        onClick={() => close()}
        aria-label="Not now"
        className="absolute right-2.5 top-2.5 rounded-md p-1 text-muted hover:bg-panel-2 hover:text-ink"
      >
        <IconX size={16} />
      </button>
      <div className="flex gap-3">
        <img src="/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 pr-5">
          <p id="install-prompt-title" className="text-sm font-semibold text-ink">
            Get the Fico app
          </p>
          {mode === 'one-tap' ? (
            <>
              <p className="mt-0.5 text-sm text-muted">
                Its own icon and window, opens instantly, works offline. Free — nothing to download
                from a store.
              </p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => void install()} disabled={busy} className="btn btn-primary btn-sm">
                  <IconDownload size={14} />
                  {busy ? 'Opening…' : 'Install'}
                </button>
                <button type="button" onClick={() => close()} className="btn btn-ghost btn-sm">
                  Not now
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-0.5 text-sm text-muted">Add it to your home screen in two taps:</p>
              <ol className="mt-1.5 list-decimal space-y-0.5 pl-4 text-sm text-ink">
                {ios.steps.slice(0, 2).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <button type="button" onClick={() => close()} className="btn btn-ghost btn-sm mt-2">
                Got it
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default InstallPrompt
