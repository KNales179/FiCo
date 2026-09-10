import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { ensureDeviceId } from '../features/auth/localAuth'
import { MetadataKeys, metadataRepository } from '../repositories'
import {
  countFailedForSpace,
  countPendingForSpace,
  retryFailed,
  runSync,
} from '../features/sync/engine'
import { emitDataChanged, onMutation } from '../features/sync/events'
import type { MutationContext } from '../features/sync/context'
import { useAuth } from '../hooks/useAuth'
import { useSpace } from '../hooks/useSpace'
import { useConnectivity } from '../hooks/useConnectivity'
import { SyncContext, type SyncPhase } from './sync-context'

const HEALTHY_INTERVAL = 45_000
const DEBOUNCE_MS = 2_500
// Exponential backoff after consecutive failures (capped).
const BACKOFF = [5_000, 15_000, 45_000, 120_000, 300_000]

export const SyncProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAuthenticated } = useAuth()
  const { activeSpaceId } = useSpace()
  const { online, navigatorOnline } = useConnectivity()

  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [phase, setPhase] = useState<SyncPhase>('IDLE')
  const [pendingCount, setPendingCount] = useState(0)
  const [failedCount, setFailedCount] = useState(0)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)

  const running = useRef(false)
  const failures = useRef(0)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    void ensureDeviceId().then(setDeviceId).catch(() => setDeviceId(null))
    void metadataRepository
      .get<string>(MetadataKeys.lastSyncAt)
      .then((v) => setLastSyncAt(v ?? null))
  }, [])

  const userId = user?.id ?? null
  const ctx: MutationContext | null = useMemo(
    () =>
      isAuthenticated && activeSpaceId && userId && deviceId
        ? { spaceId: activeSpaceId, userId, deviceId }
        : null,
    [isAuthenticated, activeSpaceId, userId, deviceId],
  )

  const refreshCounts = useCallback(async () => {
    if (!activeSpaceId) return
    setPendingCount(await countPendingForSpace(activeSpaceId))
    setFailedCount(await countFailedForSpace(activeSpaceId))
  }, [activeSpaceId])

  const syncNow = useCallback(async () => {
    if (!ctx || running.current) return
    if (!online) {
      setPhase('OFFLINE')
      await refreshCounts()
      return
    }

    running.current = true
    setPhase('SYNCING')
    try {
      const outcome = await runSync(ctx)
      if (outcome.offline) {
        // A failed request while the device reports a network means the
        // server itself didn't answer — don't call that "offline".
        setPhase(navigatorOnline ? 'UNREACHABLE' : 'OFFLINE')
        failures.current += 1
      } else if (!outcome.ok) {
        setPhase('ERROR')
        setLastError(outcome.error ?? 'Sync failed')
        failures.current += 1
      } else {
        setPhase('IDLE')
        setLastError(null)
        setLastSyncAt(new Date().toISOString())
        failures.current = 0
        if (outcome.applied > 0) emitDataChanged()
      }
    } finally {
      running.current = false
      await refreshCounts()
    }
  }, [ctx, refreshCounts, online, navigatorOnline])

  const retryNow = useCallback(async () => {
    if (activeSpaceId) {
      await retryFailed(activeSpaceId)
      failures.current = 0
      await syncNow()
    }
  }, [activeSpaceId, syncNow])

  // Initial sync + on space / connectivity change.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshCounts()
    if (ctx && online) {
      failures.current = 0
      void syncNow()
    }
  }, [ctx, online, refreshCounts, syncNow])

  // Debounced sync after a local mutation.
  useEffect(() => {
    return onMutation(() => {
      void refreshCounts()
      if (debounce.current) clearTimeout(debounce.current)
      debounce.current = setTimeout(() => void syncNow(), DEBOUNCE_MS)
    })
  }, [refreshCounts, syncNow])

  // Self-scheduling background sync — healthy cadence, or exponential backoff
  // after failures.
  useEffect(() => {
    if (!ctx || !online) return
    let cancelled = false

    const schedule = () => {
      if (cancelled) return
      const delay =
        failures.current === 0
          ? HEALTHY_INTERVAL
          : BACKOFF[
              Math.min(failures.current - 1, BACKOFF.length - 1)
            ]
      timer.current = setTimeout(async () => {
        await syncNow()
        schedule()
      }, delay)
    }
    schedule()

    return () => {
      cancelled = true
      if (timer.current) clearTimeout(timer.current)
    }
  }, [ctx, online, syncNow])

  return (
    <SyncContext.Provider
      value={{
        phase: !online ? 'OFFLINE' : phase,
        pendingCount,
        failedCount,
        lastSyncAt,
        lastError,
        syncNow,
        retryFailed: retryNow,
      }}
    >
      {children}
    </SyncContext.Provider>
  )
}
