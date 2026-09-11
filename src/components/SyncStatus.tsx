import { useSync } from '../hooks/useSync'

const LABELS: Record<string, string> = {
  IDLE: 'All changes synced',
  SYNCING: 'Syncing…',
  OFFLINE: 'Offline — saved on this device',
  UNREACHABLE: "Can't reach the server — retrying",
  ERROR: 'Sync failed — will retry',
}

const DOT: Record<string, string> = {
  IDLE: 'bg-emerald-500',
  SYNCING: 'bg-sky-500',
  OFFLINE: 'bg-gray-400',
  UNREACHABLE: 'bg-amber-500',
  ERROR: 'bg-red-500',
}

/** Persistent, unobtrusive synchronization indicator (Architecture §54). */
const SyncStatus = () => {
  const { phase, pendingCount, failedCount, syncNow, retryFailed, discardFailed } =
    useSync()

  if (failedCount > 0) {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-danger">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-red-500" />
        {failedCount} change{failedCount === 1 ? '' : 's'} rejected
        <button
          type="button"
          onClick={() => void retryFailed()}
          className="underline hover:no-underline"
        >
          retry
        </button>
        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                `Discard ${failedCount} rejected change${
                  failedCount === 1 ? '' : 's'
                }? This can't be undone.`,
              )
            )
              void discardFailed()
          }}
          className="underline hover:no-underline"
        >
          discard
        </button>
      </span>
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
