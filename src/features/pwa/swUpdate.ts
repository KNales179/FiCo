import { registerSW } from 'virtual:pwa-register'

/** Dispatched on `window` once a new service-worker version is ready. */
export const SW_UPDATE_EVENT = 'fico:sw-update-available'

let applyUpdate: ((reloadPage?: boolean) => Promise<void>) | null = null

/**
 * Registers the service worker without forcing anything on the person
 * using the app. `vite-plugin-pwa`'s `autoUpdate` mode silently reloads
 * the page the instant a new build is detected — with no warning, which
 * was wiping out whatever someone was mid-typing (owner feedback: "when
 * I'm typing it suddenly reloads and the one I'm typing is gone"). A new
 * version now just sits ready in the background until `applyPendingUpdate`
 * is called — normally from `UpdateBanner`, after a person clicks refresh.
 */
export const initServiceWorker = (): void => {
  applyUpdate = registerSW({
    onNeedRefresh() {
      window.dispatchEvent(new CustomEvent(SW_UPDATE_EVENT))
    },
  })
}

/** Applies a pending update and reloads — call only from a person's own click. */
export const applyPendingUpdate = async (): Promise<void> => {
  if (applyUpdate) await applyUpdate(true)
}
