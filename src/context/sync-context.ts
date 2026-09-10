import { createContext } from 'react'

export type SyncPhase = 'IDLE' | 'SYNCING' | 'OFFLINE' | 'ERROR'

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
}

export const SyncContext = createContext<SyncContextValue | undefined>(
  undefined,
)
