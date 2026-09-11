import { createContext } from 'react'

/**
 * IDLE       — nothing to do, last sync succeeded
 * SYNCING    — a sync cycle is running
 * OFFLINE    — the device has no network (`navigator.onLine` is false)
 * UNREACHABLE— the device is online but the Fico server didn't answer
 *              (server down, wrong `VITE_API_URL`, CORS, stale service worker)
 * ERROR      — the server answered but the sync failed
 */
export type SyncPhase =
  | 'IDLE'
  | 'SYNCING'
  | 'OFFLINE'
  | 'UNREACHABLE'
  | 'ERROR'

export interface SyncContextValue {
  phase: SyncPhase
  pendingCount: number
  /** Changes the server permanently rejected — need a manual retry. */
  failedCount: number
  lastSyncAt: string | null
  lastError: string | null
  /** Force a sync cycle now. */
  syncNow: () => Promise<void>
  /** Re-queue every failed change and sync. */
  retryFailed: () => Promise<void>
  /** Give up on every failed change (drop it locally; next pull reconciles). */
  discardFailed: () => Promise<void>
}

export const SyncContext = createContext<SyncContextValue | undefined>(
  undefined,
)
