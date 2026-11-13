import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { ensureDeviceId } from '../features/auth/localAuth'
import { MetadataKeys, metadataRepository, syncEventRepository } from '../repositories'
import {
  countFailedForSpace,
  countPendingForSpace,
  discardFailed,
  retryFailed,
  requeueRepairableFailures,
  runSync,
  spaceSyncInfo,
  takeStaleApplied,
  takeSyncIssues,
} from '../features/sync/engine'
import { emitDataChanged, emitSessionRejected, onMutation } from '../features/sync/events'
import type { MutationContext } from '../features/sync/context'
import { useAuth } from '../hooks/useAuth'
import { useSpace } from '../hooks/useSpace'
import { useConnectivity } from '../hooks/useConnectivity'
import { isDemoSpace } from '../features/demo/space'
import { uploadWaitingAttachments } from '../features/attachments'
import { noticesForIssues } from '../features/sync/describe'
import { flushOnLeave } from '../features/sync/background'
import { refreshServerLimits } from '../features/sync/limits'
import { api } from '../lib/api'
import { addLocalNotifications } from '../features/notifications'
import { uploadRemoteAttachment } from '../services/attachmentService'
import { SyncContext, type SyncPhase } from './sync-context'

const HEALTHY_INTERVAL = 45_000
const DEBOUNCE_MS = 2_500
// Exponential backoff after consecutive failures (capped).
const BACKOFF = [5_000, 15_000, 45_000, 120_000, 300_000]

export const SyncProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAuthenticated } = useAuth()
  const { activeSpaceId, spaces } = useSpace()
  const { online, navigatorOnline, serverReachable } = useConnectivity()

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
      // Never sync the tour's local-only sample Finance.
      isAuthenticated && activeSpaceId && !isDemoSpace(activeSpaceId) && userId && deviceId
        ? { spaceId: activeSpaceId, userId, deviceId }
        : null,
    [isAuthenticated, activeSpaceId, userId, deviceId],
  )

  const [activeInfo, setActiveInfo] = useState<{ pulledAt: string | null; downloaded: boolean }>({
    pulledAt: null,
    downloaded: true,
  })

  const refreshCounts = useCallback(async () => {
    if (!activeSpaceId) return
    setPendingCount(await countPendingForSpace())
    setFailedCount(await countFailedForSpace())
    setActiveInfo(
      isDemoSpace(activeSpaceId) ? { pulledAt: null, downloaded: true } : await spaceSyncInfo(activeSpaceId),
    )
  }, [activeSpaceId])

  // Rejected / overwritten changes (from this sync, or a background one)
  // become a notification with every detail, so nothing is silently lost.
  const financeNames = useMemo(
    () => Object.fromEntries(spaces.map((s) => [s.id, s.name])) as Record<string, string>,
    [spaces],
  )
  const announceIssues = useCallback(async () => {
    const issues = await takeSyncIssues()
    if (issues.length) addLocalNotifications(noticesForIssues(issues, financeNames))
  }, [financeNames])

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
      const outcome = await runSync(
        ctx,
        spaces.map((s) => s.id),
      )
      if (outcome.offline) {
        // A failed request while the device reports a network means the
        // server itself didn't answer — don't call that "offline".
        setPhase(navigatorOnline ? 'UNREACHABLE' : 'OFFLINE')
        failures.current += 1
      } else if (!outcome.ok) {
        setPhase('ERROR')
        setLastError(outcome.error ?? 'Sync failed')
        failures.current += 1
        // Signed out on the server (expired after a long time offline, or
        // ended by an admin): tell the app now, rather than syncing into a
        // wall until the next background check. Unsynced work is kept.
        if (outcome.status === 401) emitSessionRejected()
      } else {
        setPhase('IDLE')
        setLastError(null)
        setLastSyncAt(new Date().toISOString())
        failures.current = 0
        // Receipt photos saved on this device (e.g. from the scanner) go up
        // now that their records are on the server.
        void uploadWaitingAttachments((a, blob) =>
          uploadRemoteAttachment(a.spaceId, {
            entityType: a.entityType,
            entityId: a.entityId,
            file: blob,
            fileName: a.fileName,
            clientId: a.id,
          }).then(() => undefined),
        ).then((n) => {
          if (n > 0) emitDataChanged()
        })
        if (outcome.applied > 0 || takeStaleApplied()) emitDataChanged()
      }
    } finally {
      running.current = false
      await refreshCounts()
      await announceIssues()
    }
  }, [ctx, refreshCounts, online, navigatorOnline, announceIssues, spaces])

  const retryNow = useCallback(async () => {
    if (activeSpaceId) {
      await retryFailed()
      failures.current = 0
      await syncNow()
    }
  }, [activeSpaceId, syncNow])

  const discardNow = useCallback(async () => {
    if (activeSpaceId) {
      // Keep a record of exactly what's being dropped, so it can be re-entered.
      const failed = (await syncEventRepository.listByStatus('FAILED')).filter((e) => e.entityType !== 'attachment')
      if (failed.length) {
        const notices = noticesForIssues(
          failed.map((e) => ({
            kind: 'REJECTED' as const,
            spaceId: e.spaceId ?? '',
            entityType: e.entityType,
            entityId: e.entityId,
            operation: e.operation,
            attempted: (e.payload ?? {}) as Record<string, unknown>,
            reason: e.lastError ?? 'The server couldn’t save it',
          })),
          financeNames,
        ).map((n) => ({
          ...n,
          title: `Discarded ${failed.length === 1 ? 'a change' : `${failed.length} changes`} that couldn’t sync`,
          body: 'They were removed from this device, but here are their details in case you want to enter them again.',
        }))
        addLocalNotifications(notices)
      }
      await discardFailed()
      await refreshCounts()
      emitDataChanged()
    }
  }, [activeSpaceId, refreshCounts, financeNames])

  // Once per app start (online): take the server's current size limits, so
  // text is trimmed to exactly what it accepts.
  const limitsFetched = useRef(false)
  useEffect(() => {
    if (!ctx || !online || limitsFetched.current) return
    limitsFetched.current = true
    void refreshServerLimits(() =>
      api<{ text: Record<string, Record<string, number>>; listLimit: number; listItemName: number }>('/sync/limits'),
    )
  }, [ctx, online])

  // Once per app start: changes that failed only because of an old bug
  // (shopping check-offs sent incomplete) get another go.
  useEffect(() => {
    if (!ctx) return
    void requeueRepairableFailures().then((n) => {
      if (n > 0) void refreshCounts()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx?.userId])

  // Initial sync + on space / connectivity change.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshCounts()
    if (ctx && online) {
      failures.current = 0
      void syncNow()
    }
  }, [ctx, online, refreshCounts, syncNow])

  // The server just started answering after a stretch of not — a sleeping
  // free-tier host finishing its wake-up, say. Don't sit out whatever backoff
  // the failed attempts built up: sync right now, so what was saved on this
  // device while it slept goes up the moment it can.
  const wasReachable = useRef<boolean | null>(null)
  useEffect(() => {
    if (serverReachable === true && wasReachable.current === false) {
      failures.current = 0
      void syncNow()
    }
    wasReachable.current = serverReachable
  }, [serverReachable, syncNow])

  // Leaving the app (switching away, locking the phone, closing the tab):
  // send what's waiting right now — the only chance on an iPhone, which
  // can't sync in the background.
  useEffect(() => {
    if (!deviceId) return
    const leave = () => {
      if (document.visibilityState === 'hidden' || !document.hasFocus()) void flushOnLeave(deviceId)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void flushOnLeave(deviceId)
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', leave)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', leave)
    }
  }, [deviceId])

  // The service worker synced in the background (Android) — catch up.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    const onMessage = (e: MessageEvent) => {
      if ((e.data as { type?: string } | null)?.type !== 'fico-synced') return
      void refreshCounts()
      void announceIssues()
      emitDataChanged()
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [refreshCounts, announceIssues])

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
        activeSyncedAt: activeInfo.pulledAt,
        activeDownloaded: activeInfo.downloaded,
        lastError,
        syncNow,
        retryFailed: retryNow,
        discardFailed: discardNow,
      }}
    >
      {children}
    </SyncContext.Provider>
  )
}
