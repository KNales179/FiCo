import { useSync } from '../hooks/useSync'

const LABELS: Record<string, string> = {
  IDLE: 'All changes synced',
  SYNCING: 'Syncing…',
  OFFLINE: 'Offline — saved on this device',
  ERROR: 'Sync failed — will retry',
}

const DOT: Record<string, string> = {
  IDLE: 'bg-emerald-500',
  SYNCING: 'bg-sky-500',
  OFFLINE: 'bg-gray-400',
  ERROR: 'bg-red-500',
}

/** Persistent, unobtrusive synchronization indicator (Architecture §54). */
const SyncStatus = () => {
  const { phase, pendingCount, failedCount, syncNow, retryFailed } =
    useSync()

  if (failedCount > 0) {
    return (
      <button
        type="button"
        onClick={() => void retryFailed()}
        title="Retry failed changes"
        className="inline-flex items-center gap-2 text-xs text-danger"
      >
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full bg-red-500"
        />
        {failedCount} change{failedCount === 1 ? '' : 's'} failed — retry
      </button>
    )
  }

  const label =
    pendingCount > 0 && phase !== 'SYNCING'
      ? `${pendingCount} change${pendingCount === 1 ? '' : 's'} pending`
      : LABELS[phase]

  return (
    <button
      type="button"
      onClick={() => void syncNow()}
      title="Sync now"
      className="inline-flex items-center gap-2 text-xs text-muted"
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${DOT[phase]}`}
      />
      {label}
    </button>
  )
}

export default SyncStatus
