import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAppeals, type AdminAppeal } from '../services/appealService'
import { Alert, Card, PageHeader, SkeletonRow } from '../components/ui'
import { IconChevronRight, IconMessage } from '../components/icons'

const APPEAL_LOOK: Record<AdminAppeal['status'], { label: string; tone: string }> = {
  OPEN: { label: 'Needs review', tone: 'bg-brand/15 text-brand' },
  LIFTED: { label: 'Lifted', tone: 'bg-success/12 text-success' },
  SHORTENED: { label: 'Shortened', tone: 'bg-success/12 text-success' },
  KEPT: { label: 'Kept', tone: 'bg-warning/15 text-warning' },
}

const ago = (iso: string) => {
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

/** Admin → Appeals: restricted people asking for another look. Tap one to review it. */
const AdminAppeals = () => {
  const [appeals, setAppeals] = useState<AdminAppeal[] | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'open' | 'done'>('open')

  const load = useCallback(async () => {
    try {
      const res = await listAppeals()
      setAppeals(res.appeals)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load appeals')
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const open = useMemo(() => appeals?.filter((a) => a.status === 'OPEN') ?? [], [appeals])
  const done = useMemo(() => appeals?.filter((a) => a.status !== 'OPEN') ?? [], [appeals])
  const shown = tab === 'open' ? open : done

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Appeals" icon={IconMessage} description="Restricted people asking the team to take another look." />

      <div className="inline-flex rounded-xl border border-line bg-panel p-1 text-sm">
        {(
          [
            ['open', `Needs review${open.length ? ` · ${open.length}` : ''}`],
            ['done', 'Reviewed'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${tab === key ? 'bg-brand text-brand-ink' : 'text-muted hover:text-ink'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <Alert>{error}</Alert>}
      {!appeals && !error && (
        <Card>
          <SkeletonRow />
          <SkeletonRow />
        </Card>
      )}

      {appeals && shown.length === 0 && (
        <Card className="py-8 text-center text-sm text-muted">
          {tab === 'open' ? 'No appeals waiting — all caught up.' : 'Nothing reviewed yet.'}
        </Card>
      )}

      {shown.length > 0 && (
        <ul className="space-y-2.5">
          {shown.map((a) => {
            const name = a.user?.displayName || a.user?.username || 'Deleted user'
            const look = APPEAL_LOOK[a.status]
            return (
              <li key={a.id}>
                <Link to={`/admin/appeals/${a.id}`} className="card flex items-start gap-3 transition-colors hover:border-brand/40">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/15 text-sm font-bold text-brand">
                    {name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${look.tone}`}>{look.label}</span>
                      <span className="text-xs text-muted">{ago(a.createdAt)}</span>
                    </span>
                    <span className="mt-1 line-clamp-2 block text-sm text-muted">“{a.message}”</span>
                    <span className="mt-1 block truncate text-xs text-muted">Restricted for: {a.restriction.reason}</span>
                  </span>
                  <IconChevronRight size={18} className="mt-2 shrink-0 text-muted" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default AdminAppeals
