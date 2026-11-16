import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useSpace } from '../hooks/useSpace'
import { useMoney } from '../hooks/useMoney'
import { useAuth } from '../hooks/useAuth'
import { canSeeActivity } from '../features/spaces/roles'
import { isNetworkError } from '../lib/api'
import { fetchActionLogs, type ActionLogEntry } from '../services/actionLogService'
import {
  RECORD_KINDS,
  dayLabel,
  describeChange,
  friendlySummary,
  type ActivityTab,
  type RecordKind,
} from '../features/activity/format'
import SectionTabs from '../components/SectionTabs'
import { Button, Card, EmptyState, PageHeader, SkeletonLines } from '../components/ui'
import { IconArrowRightLeft, IconClock, IconReceipt, IconUsers } from '../components/icons'

const TABS: Array<{ value: ActivityTab; label: string; icon: typeof IconReceipt; blurb: string; empty: string }> = [
  {
    value: 'records',
    label: 'Records',
    icon: IconReceipt,
    blurb: 'Money, bills, to-buy lists and budgets — who added, changed or removed what. Private records never show here.',
    empty: 'No record changes yet.',
  },
  {
    value: 'members',
    label: 'Members & roles',
    icon: IconUsers,
    blurb: 'People joining or leaving, invitations, role changes, and ownership handovers.',
    empty: 'No member changes yet.',
  },
  {
    value: 'conflicts',
    label: 'Sync conflicts',
    icon: IconArrowRightLeft,
    blurb: 'When two people changed the same thing at once, which change was kept.',
    empty: 'No conflicts — every change synced cleanly.',
  },
]

const ACTION_DOT: Record<string, string> = {
  CREATE: 'bg-success',
  DELETE: 'bg-danger',
  CONFLICT: 'bg-warning',
  MEMBER_REMOVE: 'bg-danger',
  MEMBER_ADD: 'bg-success',
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

const Activity = () => {
  const { activeSpace, activeSpaceId } = useSpace()
  const { accounts, categories } = useMoney()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  // A personal Finance is just you: your own history, no Members tab.
  const personal = activeSpace?.type === 'PERSONAL'
  const tabs = personal ? TABS.filter((t) => t.value !== 'members') : TABS
  const tabParam = searchParams.get('tab')
  const tab: ActivityTab =
    tabParam === 'conflicts' ? 'conflicts' : tabParam === 'members' && !personal ? 'members' : 'records'
  const kind = (RECORD_KINDS.find((k) => k.value === searchParams.get('kind'))?.value ?? '') as RecordKind
  const meta = tabs.find((t) => t.value === tab)!

  const [logs, setLogs] = useState<ActionLogEntry[]>([])
  const [nextBefore, setNextBefore] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  const allowed = Boolean(activeSpace && (personal || canSeeActivity(activeSpace.role)))

  const load = useCallback(
    async (before?: string) => {
      if (!activeSpaceId || !allowed) return
      setError('')
      if (before) setLoadingMore(true)
      else setLoading(true)
      try {
        const res = await fetchActionLogs(activeSpaceId, {
          before,
          limit: 50,
          group: tab,
          kind: tab === 'records' ? kind || undefined : undefined,
        })
        setLogs((prev) => (before ? [...prev, ...res.logs] : res.logs))
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
        setLoadingMore(false)
      }
    },
    [activeSpaceId, allowed, tab, kind],
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  // Ids in "what changed" shown as the names people know.
  const ctx = useMemo(
    () => ({
      currency: activeSpace?.currency,
      accounts: new Map(accounts.map((a) => [a.id, a.name])),
      categories: new Map(categories.map((c) => [c.id, c.name])),
    }),
    [activeSpace?.currency, accounts, categories],
  )

  // Newest first, under one heading per day.
  const days = useMemo(() => {
    const out: Array<{ day: string; entries: ActionLogEntry[] }> = []
    for (const log of logs) {
      const day = dayLabel(log.createdAt)
      const last = out[out.length - 1]
      if (last?.day === day) last.entries.push(log)
      else out.push({ day, entries: [log] })
    }
    return out
  }, [logs])

  if (activeSpace && !allowed) {
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

  const href = (next: { tab?: ActivityTab; kind?: RecordKind }) => {
    const p = new URLSearchParams()
    const t = next.tab ?? tab
    if (t !== 'records') p.set('tab', t)
    const k = next.kind ?? (next.tab ? '' : kind)
    if (t === 'records' && k) p.set('kind', k)
    const qs = p.toString()
    return `/activity${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="space-y-4">
      <SectionTabs
        label="Activity sections"
        tabs={tabs.map((t) => ({ to: href({ tab: t.value }), label: t.label, icon: t.icon, active: t.value === tab }))}
      />

      <div className="mx-auto max-w-3xl space-y-3">
        <PageHeader
          icon={IconClock}
          title={`Activity · ${meta.label}`}
          description={personal && tab === 'records' ? 'Everything you added, changed or removed here, and what changed. Private records never show here.' : meta.blurb}
        />

        {tab === 'records' && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show">
            {RECORD_KINDS.map((k) => (
              <Link
                key={k.value || 'all'}
                to={href({ kind: k.value })}
                aria-current={k.value === kind ? 'true' : undefined}
                className={[
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  k.value === kind ? 'border-brand bg-brand/10 text-brand' : 'border-line text-muted hover:text-ink',
                ].join(' ')}
              >
                {k.label}
              </Link>
            ))}
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        {loading ? (
          <Card>
            <SkeletonLines count={5} />
          </Card>
        ) : logs.length === 0 && !error ? (
          <EmptyState title={meta.empty}>Changes made in {activeSpace?.name} will show up here.</EmptyState>
        ) : (
          days.map(({ day, entries }) => (
            <section key={day} aria-label={day}>
              <h2 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-muted">{day}</h2>
              <ul className="card divide-y divide-line p-0 sm:p-0">
                {entries.map((log) => {
                  // "checked off "Fish"" already says it — no "Checked off: No → Yes" under it.
                  const lines = (log.action === 'CHECK' || log.action === 'UNCHECK' ? [] : (log.changes ?? []))
                    .map((c) => describeChange(c, ctx))
                    .filter((l): l is NonNullable<typeof l> => Boolean(l))
                  return (
                    <li key={log.id} className="flex gap-3 px-4 py-2.5 text-sm">
                      <span
                        aria-hidden="true"
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ACTION_DOT[log.action] ?? 'bg-brand'}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block">
                          <span className="font-medium text-ink">
                            {log.actorId === user?.id ? 'You' : (log.actorName ?? 'Someone')}
                          </span>{' '}
                          <span className="text-ink/90">{friendlySummary(log.summary)}</span>
                        </span>
                        {lines.length > 0 && (
                          <ul className="mt-1 space-y-0.5 text-xs text-muted">
                            {lines.map((l) => (
                              <li key={l.label}>
                                <span className="font-medium">{l.label}:</span>{' '}
                                <span className="line-through decoration-muted/60">{l.from}</span>
                                {' → '}
                                <span className="font-medium text-ink">{l.to}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </span>
                      <time dateTime={log.createdAt} className="shrink-0 text-xs tabular-nums text-muted">
                        {timeOf(log.createdAt)}
                      </time>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))
        )}

        {nextBefore && !loading && (
          <div className="flex justify-center">
            <Button onClick={() => void load(nextBefore)} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : 'Load older'}
            </Button>
          </div>
        )}

        {tab === 'records' && logs.length > 0 && (
          <p className="px-1 text-xs text-muted">
            Edits show what changed from Fico 2.10 on; older entries only say what happened.
          </p>
        )}
      </div>
    </div>
  )
}

export default Activity
