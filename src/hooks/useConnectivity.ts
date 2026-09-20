import { useEffect, useState } from 'react'
import { probeServer } from '../lib/api'

/**
 * checking    — the first probe hasn't finished yet
 * reachable   — the Fico server answered
 * waking      — the device has a network but the server isn't answering *yet*;
 *               almost always a free-tier host starting up from sleep, which
 *               takes 20-50s, so this is treated as "keep knocking", not "down"
 * unreachable — same, but it's been long enough that it's probably really down
 * offline     — the device itself reports no network
 */
export type ServerState =
  | 'checking'
  | 'reachable'
  | 'waking'
  | 'unreachable'
  | 'offline'

export interface Connectivity {
  /** `navigator.onLine` — whether the device thinks it has a network. */
  navigatorOnline: boolean
  /** Did a probe to `/api/health` succeed? `null` until the first check. */
  serverReachable: boolean | null
  /** The one state the UI should describe — see `ServerState`. */
  serverState: ServerState
  /**
   * The value the app should act on: online if the device reports a network
   * *or* the server actually answered (covers a lying `navigator.onLine`).
   */
  online: boolean
  /** Re-run the probe now. */
  recheck: () => void
}

/** While the server is answering, a relaxed check is plenty. */
const HEALTHY_PROBE_MS = 30_000
/** While it isn't, keep knocking — the moment it wakes, the app should notice. */
const RETRY_PROBE_MS = 3_000
const HEALTHY_PROBE_TIMEOUT_MS = 5_000
/** Patient enough to be mid-request when a sleeping host finishes waking. */
const WAKING_PROBE_TIMEOUT_MS = 12_000
/** How long "waking up" is a fair description before calling it unreachable. */
const WAKING_WINDOW_MS = 90_000

// One probe loop shared by every hook instance, so mounting the hook in
// several providers doesn't mean several timers hammering `/api/health`.
let reachable: boolean | null = null
let failingSince: number | null = null
let currentState: ServerState = 'checking'
let inFlight: Promise<boolean> | null = null
let loopTimer: ReturnType<typeof setTimeout> | null = null
let subscribers = 0
const listeners = new Set<() => void>()

const computeState = (): ServerState => {
  if (reachable === true) return 'reachable'
  if (reachable === null) return 'checking'
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline'
  return failingSince !== null && Date.now() - failingSince < WAKING_WINDOW_MS
    ? 'waking'
    : 'unreachable'
}

const refreshState = () => {
  currentState = computeState()
  listeners.forEach((l) => l())
}

/** Queue the next probe: relaxed while healthy, quick while the server isn't answering. */
const scheduleProbe = () => {
  if (loopTimer) clearTimeout(loopTimer)
  loopTimer = null
  if (subscribers === 0) return
  loopTimer = setTimeout(
    () => {
      loopTimer = null
      void runProbe()
    },
    reachable === false ? RETRY_PROBE_MS : HEALTHY_PROBE_MS,
  )
}

const runProbe = (): Promise<boolean> => {
  if (!inFlight) {
    inFlight = probeServer(
      reachable === true ? HEALTHY_PROBE_TIMEOUT_MS : WAKING_PROBE_TIMEOUT_MS,
    )
      .then((ok) => {
        if (ok) {
          reachable = true
          failingSince = null
        } else {
          if (reachable !== false) failingSince = Date.now()
          reachable = false
        }
        refreshState()
        return ok
      })
      .finally(() => {
        inFlight = null
        scheduleProbe()
      })
  }
  return inFlight
}

/**
 * Connectivity that doesn't just trust `navigator.onLine` (which is wrong often
 * enough — VPNs, virtual adapters, some Windows/Chrome combos report `false`
 * with a working connection). Confirms with a real request to the Fico API,
 * and — when that request fails on a device that has a network — keeps
 * retrying every few seconds instead of giving up, since the usual cause is
 * a free-tier backend that simply hasn't finished waking up.
 */
export const useConnectivity = (): Connectivity => {
  const [navigatorOnline, setNavigatorOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [serverReachable, setServerReachable] = useState<boolean | null>(
    reachable,
  )
  const [serverState, setServerState] = useState<ServerState>(currentState)

  useEffect(() => {
    const sync = () => {
      setServerReachable(reachable)
      setServerState(currentState)
    }
    listeners.add(sync)

    const onOnline = () => {
      setNavigatorOnline(true)
      void runProbe()
    }
    const onOffline = () => {
      setNavigatorOnline(false)
      refreshState()
    }
    // Coming back to the app after it sat in the background — don't make
    // anyone wait out the timer to find out the server is up.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void runProbe()
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onVisible)

    subscribers += 1
    void runProbe()

    return () => {
      listeners.delete(sync)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      document.removeEventListener('visibilitychange', onVisible)
      subscribers -= 1
      if (subscribers === 0 && loopTimer) {
        clearTimeout(loopTimer)
        loopTimer = null
      }
    }
  }, [])

  return {
    navigatorOnline,
    serverReachable,
    serverState,
    online: navigatorOnline || serverReachable === true,
    recheck: () => void runProbe(),
  }
}
