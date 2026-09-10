import { useEffect, useState } from 'react'
import { probeServer } from '../lib/api'

export interface Connectivity {
  /** `navigator.onLine` — whether the device thinks it has a network. */
  navigatorOnline: boolean
  /** Did a probe to `/api/health` succeed? `null` until the first check. */
  serverReachable: boolean | null
  /**
   * The value the app should act on: online if the device reports a network
   * *or* the server actually answered (covers a lying `navigator.onLine`).
   */
  online: boolean
  /** Re-run the probe now. */
  recheck: () => void
}

const PROBE_INTERVAL = 30_000

// One probe loop shared by every hook instance, so mounting the hook in three
// providers doesn't mean three timers hammering `/api/health`.
let reachable: boolean | null = null
let inFlight: Promise<boolean> | null = null
const listeners = new Set<() => void>()

const notify = () => listeners.forEach((l) => l())

const runProbe = (): Promise<boolean> => {
  if (!inFlight) {
    inFlight = probeServer()
      .then((ok) => {
        reachable = ok
        notify()
        return ok
      })
      .finally(() => {
        inFlight = null
      })
  }
  return inFlight
}

/**
 * Connectivity that doesn't just trust `navigator.onLine` (which is wrong often
 * enough — VPNs, virtual adapters, some Windows/Chrome combos report `false`
 * with a working connection). Confirms with a real request to the Fico API.
 */
export const useConnectivity = (): Connectivity => {
  const [navigatorOnline, setNavigatorOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [serverReachable, setServerReachable] = useState<boolean | null>(
    reachable,
  )

  useEffect(() => {
    const sync = () => setServerReachable(reachable)
    listeners.add(sync)

    const onOnline = () => {
      setNavigatorOnline(true)
      void runProbe()
    }
    const onOffline = () => setNavigatorOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    void runProbe()
    const id = setInterval(() => void runProbe(), PROBE_INTERVAL)

    return () => {
      listeners.delete(sync)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      clearInterval(id)
    }
  }, [])

  return {
    navigatorOnline,
    serverReachable,
    online: navigatorOnline || serverReachable === true,
    recheck: () => void runProbe(),
  }
}
