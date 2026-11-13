import { useCallback, useEffect, useState } from 'react'
import { useSpace } from '../hooks/useSpace'
import { canSeeActivity } from '../features/spaces/roles'
import { isNetworkError } from '../lib/api'
import {
  fetchActionLogs,
  type ActionLogEntry,
} from '../services/actionLogService'
import { PageHeader, SkeletonLines } from '../components/ui'
import { IconClock } from '../components/icons'

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
      if (!activeSpaceId || (activeSpace && !canSeeActivity(activeSpace.role))) return
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
            ? 'You’re offline — activity loads once you’re back online.'
            : err instanceof Error
              ? err.message
              : 'Could not load activity',
        )
      } finally {
        setLoading(false)
      }
    },
    [activeSpaceId, activeSpace],
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  if (activeSpace && activeSpace.type !== 'PERSONAL' && !canSeeActivity(activeSpace.role)) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader
          icon={IconClock}
          title="Activity"
          description="Only the owner and admins of a shared Finance can see who changed what."
        />
      </div>
    )
  }

  if (activeSpace?.type === 'PERSONAL') {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader
          icon={IconClock}
          title="Activity"
          description="Activity history is for shared spaces — a personal space is just you."
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <PageHeader icon={IconClock} title="Activity" description="Who did what in this Finance, newest first." />
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {loading && (
        <div className="card">
          <SkeletonLines count={5} />
        </div>
      )}

      {!loading && (
      <ul className="card divide-y divide-line p-0 sm:p-0">
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
        {logs.length === 0 && !error && (
          <li className="px-4 py-2 text-sm text-muted">
            Nothing here yet.
          </li>
        )}
      </ul>
      )}

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
