import { lazy, type ComponentType } from 'react'

const RELOAD_KEY = 'fico.chunkReloadAt'

/**
 * `React.lazy` for a page, with one recovery step. A page's code can fail
 * to load when it was never cached on this device (offline before ever
 * opening it) or when a new version was just deployed and the old file is
 * gone. In the second case (online), one full reload picks up the new
 * version — done at most once a minute so it can never loop. Anything else
 * is left to the page error boundary to explain.
 */
export const lazyPage = <T extends ComponentType<unknown>>(load: () => Promise<{ default: T }>) =>
  lazy(async () => {
    try {
      return await load()
    } catch (error) {
      const online = typeof navigator === 'undefined' || navigator.onLine
      let last = 0
      try {
        last = Number(sessionStorage.getItem(RELOAD_KEY) || 0)
      } catch {
        // ignore
      }
      if (online && Date.now() - last > 60_000) {
        try {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
        } catch {
          // ignore
        }
        window.location.reload()
        // Keep Suspense showing its fallback while the page reloads.
        return new Promise<{ default: T }>(() => {})
      }
      throw error
    }
  })
