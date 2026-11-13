import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSync } from '../hooks/useSync'
import { useConnectivity, type ServerState } from '../hooks/useConnectivity'

/** "just now", "5 min ago", "3 hours ago", "2 days ago". */
const ago = (iso: string | null, now: number): string | null => {
  if (!iso) return null
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

/** The server not answering isn't always "down" — usually it's still waking up. */
const unreachableLabel = (state: ServerState): string => {
  if (state === 'waking') return 'Online — waking up the server…'
  if (state === 'reachable') return 'Server is back — syncing…'
  return "Can't reach the server — still trying"
}

const DOT: Record<string, string> = {
  IDLE: 'bg-emerald-500',
  SYNCING: 'bg-sky-500',
  OFFLINE: 'bg-gray-400',
  UNREACHABLE: 'bg-amber-500',
  ERROR: 'bg-red-500',
}

const changes = (n: number) => `${n} change${n === 1 ? '' : 's'}`

/**
 * Persistent, unobtrusive synchronization indicator (Architecture §54):
 * what's waiting, and how fresh the data on screen is.
 */
const SyncStatus = () => {
  const { phase, pendingCount, failedCount, activeSyncedAt, activeDownloaded, syncNow, retryFailed, discardFailed } =
    useSync()
  const { serverState } = useConnectivity()
  // Re-render each minute so "5 min ago" stays true.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(t)
  }, [])

  if (failedCount > 0) {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-danger">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-red-500" />
        {changes(failedCount)} couldn’t be saved —
        <Link to="/notifications" className="underline hover:no-underline">
          see which
        </Link>
        <button type="button" onClick={() => void retryFailed()} className="underline hover:no-underline">
          try again
        </button>
        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                `Discard ${changes(failedCount)} the server couldn’t save? Their details stay in Notifications so you can re-enter them.`,
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

  const synced = ago(activeSyncedAt, now)

  // Offline in a Finance this device has never downloaded: say so plainly.
  if (phase === 'OFFLINE' && !activeDownloaded) {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-warning">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-500" />
        Offline — this Finance isn’t on this device yet. It downloads the next time you’re online.
      </span>
    )
  }

  const waiting = pendingCount > 0 ? `${changes(pendingCount)} waiting to sync` : null
  const label =
    phase === 'UNREACHABLE'
      ? [unreachableLabel(serverState), waiting].filter(Boolean).join(' · ')
      : phase === 'SYNCING'
        ? 'Syncing…'
        : phase === 'OFFLINE'
          ? ['Offline', waiting ?? 'saved on this device', synced && `last synced ${synced}`].filter(Boolean).join(' · ')
          : phase === 'ERROR'
            ? ['Sync failed — will retry', waiting].filter(Boolean).join(' · ')
            : waiting
              ? [waiting, synced && `last synced ${synced}`].filter(Boolean).join(' · ')
              : synced
                ? `All changes synced · ${synced}`
                : 'All changes synced'

  return (
    <button type="button" onClick={() => void syncNow()} title="Sync now" className="inline-flex items-center gap-2 text-left text-xs text-muted">
      <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${DOT[phase]}`} />
      {label}
    </button>
  )
}

export default SyncStatus
