import { useCallback, useEffect, useState } from 'react'
import { useSpace } from '../hooks/useSpace'
import { isNetworkError } from '../lib/api'
import {
  fetchActionLogs,
  type ActionLogEntry,
} from '../services/actionLogService'

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(iso).toLocaleDateString()
}

const Activity = () => {
  const { activeSpace, activeSpaceId } = useSpace()
  const [logs, setLogs] = useState<ActionLogEntry[]>([])
  const [nextBefore, setNextBefore] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(
    async (before?: string) => {
      if (!activeSpaceId) return
      setError('')
      if (!before) setLoading(true)
      try {
        const res = await fetchActionLogs(activeSpaceId, {
          before,
          limit: 50,
        })
        setLogs((prev) =>
          before ? [...prev, ...res.logs] : res.logs,
        )
        setNextBefore(res.nextBefore)
      } catch (err) {
        setError(
          isNetworkError(err)
            ? 'Activity is only available online'
            : err instanceof Error
              ? err.message
              : 'Could not load activity',
        )
      } finally {
        setLoading(false)
      }
    },
    [activeSpaceId],
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  if (activeSpace?.type === 'PERSONAL') {
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="mt-2 text-sm text-muted">
          Activity history is for shared spaces — a personal space is just you.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {loading && <p className="text-sm text-muted">Loading…</p>}

      <ul className="divide-y rounded border">
        {logs.map((log) => (
          <li key={log.id} className="px-4 py-2 text-sm">
            <span className="font-medium">
              {log.actorName ?? 'Someone'}
            </span>{' '}
            {log.summary}
            <span className="ml-2 text-xs text-gray-400">
              {timeAgo(log.createdAt)}
            </span>
          </li>
        ))}
        {!loading && logs.length === 0 && (
          <li className="px-4 py-2 text-sm text-muted">
            Nothing here yet.
          </li>
        )}
      </ul>

      {nextBefore && (
        <button
          type="button"
          onClick={() => void load(nextBefore)}
          className="border px-3 py-1 text-sm"
        >
          Load older
        </button>
      )}
    </div>
  )
}

export default Activity
