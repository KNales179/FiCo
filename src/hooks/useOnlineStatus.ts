import { useSyncExternalStore } from 'react'

const subscribe = (callback: () => void) => {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)

  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

const getSnapshot = () => navigator.onLine

// Server-render / initial fallback: assume online.
const getServerSnapshot = () => true

/**
 * Tracks browser connectivity via the `online` / `offline` window events.
 * Note: `navigator.onLine` only reports whether the device has a network
 * interface, not whether the Fico API is actually reachable.
 */
export const useOnlineStatus = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
