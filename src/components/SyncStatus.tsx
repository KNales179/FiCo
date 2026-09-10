import { useOnlineStatus } from '../hooks/useOnlineStatus'

export type SyncState =
  | 'ONLINE'
  | 'OFFLINE'
  | 'SYNCING'
  | 'SYNC_PENDING'
  | 'SYNC_ERROR'

interface SyncStatusProps {
  /** Number of local changes not yet confirmed by the server. */
  pendingCount?: number
  /** Explicit state override; otherwise derived from connectivity + pendingCount. */
  state?: SyncState
}

const LABELS: Record<SyncState, string> = {
  ONLINE: 'All changes synced',
  OFFLINE: 'Offline — saved locally',
  SYNCING: 'Syncing…',
  SYNC_PENDING: 'Changes pending',
  SYNC_ERROR: 'Sync failed — will retry',
}

const DOT_COLORS: Record<SyncState, string> = {
  ONLINE: 'bg-emerald-500',
  OFFLINE: 'bg-gray-400',
  SYNCING: 'bg-sky-500',
  SYNC_PENDING: 'bg-amber-500',
  SYNC_ERROR: 'bg-red-500',
}

/**
 * Persistent, unobtrusive synchronization indicator.
 *
 * Until the sync engine lands (Phase 18) this only reflects connectivity and a
 * caller-supplied pending count; the `state` prop lets later work drive it
 * directly.
 */
const SyncStatus = ({ pendingCount = 0, state }: SyncStatusProps) => {
  const online = useOnlineStatus()

  const resolved: SyncState =
    state ??
    (!online
      ? 'OFFLINE'
      : pendingCount > 0
        ? 'SYNC_PENDING'
        : 'ONLINE')

  const label =
    resolved === 'SYNC_PENDING' && pendingCount > 0
      ? `${pendingCount} change${pendingCount === 1 ? '' : 's'} pending`
      : LABELS[resolved]

  return (
    <span
      role="status"
      className="inline-flex items-center gap-2 text-xs text-gray-500"
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${DOT_COLORS[resolved]}`}
      />
      {label}
    </span>
  )
}

export default SyncStatus
