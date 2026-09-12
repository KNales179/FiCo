/**
 * "Install as an app" (Account page) — the actual mechanism behind what
 * most people mean by "download and install like a normal app": Chrome/
 * Edge (desktop and Android) fire `beforeinstallprompt` when a page meets
 * the PWA install criteria (a valid manifest, a registered service worker,
 * served over HTTPS — Fico already has all three), and calling `.prompt()`
 * on that captured event shows the browser's own native install dialog.
 * Once installed, it's a real icon on the home screen / app list, opens in
 * its own window with no browser chrome, and works offline — indistinguishable
 * from a native app to the person using it, at zero app-store cost or review.
 *
 * The event is captured at module load (before any component mounts) so an
 * early fire is never missed. Safari (desktop and iOS) never fires this
 * event at all — there, "install" only exists via Share → Add to Home
 * Screen, which a page cannot trigger programmatically; `platform()` below
 * lets the UI show manual instructions for that case instead.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredEvent: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredEvent = e as BeforeInstallPromptEvent
    listeners.forEach((l) => l())
  })

  window.addEventListener('appinstalled', () => {
    deferredEvent = null
    listeners.forEach((l) => l())
  })
}

export const isRunningInstalled = (): boolean => {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari's own (non-standard) flag for "opened from a home-screen icon".
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export type InstallPlatform = 'promptable' | 'ios-manual' | 'unavailable'

/** What the Account page should actually show. */
export const installPlatform = (): InstallPlatform => {
  if (isRunningInstalled()) return 'unavailable'
  if (deferredEvent) return 'promptable'

  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua)
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
  if (isIOS && isSafari) return 'ios-manual'

  return 'unavailable'
}

export const onInstallAvailabilityChange = (cb: () => void): (() => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Shows the browser's own install dialog. Resolves to whether they accepted. */
export const promptInstall = async (): Promise<boolean> => {
  if (!deferredEvent) return false
  await deferredEvent.prompt()
  const { outcome } = await deferredEvent.userChoice
  deferredEvent = null
  return outcome === 'accepted'
}
