import { useCallback, useEffect, useState } from 'react'
import {
  listFeedback,
  setFeedbackStatus,
  type FeedbackEntry,
} from '../services/feedbackService'
import { PageHeader, Card, Alert, SkeletonLines } from '../components/ui'

const formatDate = (iso: string) => new Date(iso).toLocaleString()

const AdminFeedback = () => {
  const [rows, setRows] = useState<FeedbackEntry[] | null>(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await listFeedback()
      setRows(res.feedback)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load reports')
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const toggle = async (row: FeedbackEntry) => {
    setBusyId(row.id)
    try {
      await setFeedbackStatus(row.id, row.status === 'OPEN' ? 'RESOLVED' : 'OPEN')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update that')
    } finally {
      setBusyId(null)
    }
  }

  const openCount = rows?.filter((r) => r.status === 'OPEN').length ?? 0

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title="Report & feedback"
        description={
          rows
            ? `${openCount} open of ${rows.length} total`
            : 'Every bug report and suggestion from every account'
        }
      />

      {error && <Alert>{error}</Alert>}
      {rows === null && !error && (
        <Card>
          <SkeletonLines count={4} />
        </Card>
      )}

      {rows && (
        <Card>
          <ul className="divide-y divide-line">
            {rows.length === 0 && (
              <li className="py-3 text-sm text-muted">Nothing reported yet.</li>
            )}
            {rows.map((row) => (
              <li
                key={row.id}
                className={`py-3 text-sm ${row.status === 'OPEN' ? 'bg-warning/5' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.type === 'BUG'
                          ? 'bg-danger/15 text-danger'
                          : 'bg-brand/15 text-brand'
                      }`}
                    >
                      {row.type === 'BUG' ? 'bug' : 'suggestion'}
                    </span>
                    <span className="ml-2 text-xs text-muted">
                      {row.reporter.displayName || row.reporter.username} · {formatDate(row.createdAt)}
                    </span>
                    <p className="mt-1 whitespace-pre-wrap">{row.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggle(row)}
                    disabled={busyId === row.id}
                    className="shrink-0 text-xs text-muted underline hover:text-ink disabled:opacity-50"
                  >
                    {busyId === row.id
                      ? 'saving…'
                      : row.status === 'OPEN'
                        ? 'mark resolved'
                        : 'reopen'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

export default AdminFeedback
