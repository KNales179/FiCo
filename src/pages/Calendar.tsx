import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useBills } from '../hooks/useBills'
import { useSpace } from '../hooks/useSpace'
import { useAllTransactions } from '../hooks/useAllTransactions'
import { formatMoney } from '../domain/money'
import { buildMonth, dayKey, type CalendarDay } from '../features/calendar'
import { Button, Card, PageHeader } from '../components/ui'
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconCalendarDays,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconReceipt,
  IconWallet,
} from '../components/icons'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/** "₱1.2k" — short enough for a calendar cell. */
const compact = (minor: number, currency?: string) => {
  const major = minor / 100
  if (major < 1000) return formatMoney(minor, currency).replace(/\.00$/, '')
  const symbol = formatMoney(0, currency).replace(/[\d.,\s]/g, '')
  return `${symbol}${(major / 1000).toFixed(major < 10_000 ? 1 : 0).replace(/\.0$/, '')}k`
}

const LEGEND = [
  { label: 'Payday', className: 'bg-success/25' },
  { label: 'Bill paid', className: 'bg-brand/30' },
  { label: 'Bill due', className: 'border border-warning bg-transparent' },
]

/**
 * Calendar: a month at a glance — paydays, bills paid and due, and what was
 * spent or received each day. Tap a day to see everything on it.
 */
const Calendar = () => {
  const { user } = useAuth()
  const { activeSpace } = useSpace()
  const { bills } = useBills()
  const all = useAllTransactions()
  const today = new Date()
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 })
  const [selected, setSelected] = useState(dayKey(today))
  const currency = activeSpace?.currency

  // A private record is only shown to the person who made it.
  const transactions = useMemo(
    () => all.filter((t) => t.visibility !== 'PRIVATE' || t.createdBy === user?.id),
    [all, user?.id],
  )
  const month = useMemo(
    () => buildMonth(cursor.year, cursor.month, { transactions, bills, paydays: user?.paydays ?? [], currency }),
    [cursor, transactions, bills, user?.paydays, currency],
  )
  const day: CalendarDay | undefined = month.days.find((d) => d.key === selected)
  const todayKey = dayKey(today)

  const go = (delta: number) => {
    const d = new Date(cursor.year, cursor.month - 1 + delta, 1)
    setCursor({ year: d.getFullYear(), month: d.getMonth() + 1 })
    setSelected(dayKey(d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() ? today : d))
  }
  const monthLabel = new Date(cursor.year, cursor.month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const net = month.receivedMinor - month.spentMinor

  return (
    <div className="space-y-4">
      <PageHeader icon={IconCalendarDays} title="Calendar" description="Paydays, bills and everything you spent or received, day by day." />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-ink">{monthLabel}</h2>
            <div className="flex items-center gap-1">
              <Button size="sm" iconOnly aria-label="Previous month" onClick={() => go(-1)}>
                <IconChevronLeft size={16} />
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setCursor({ year: today.getFullYear(), month: today.getMonth() + 1 })
                  setSelected(todayKey)
                }}
              >
                Today
              </Button>
              <Button size="sm" iconOnly aria-label="Next month" onClick={() => go(1)}>
                <IconChevronRight size={16} />
              </Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs sm:gap-1.5" role="grid" aria-label={monthLabel}>
            {WEEKDAYS.map((w, i) => (
              <span key={i} className="pb-1 font-semibold text-muted" role="columnheader">
                {w}
              </span>
            ))}
            {Array.from({ length: month.leading }, (_, i) => (
              <span key={`blank-${i}`} aria-hidden="true" />
            ))}
            {month.days.map((d) => {
              const isSelected = d.key === selected
              const fill = d.payday ? 'bg-success/15 text-success' : d.billsPaid.length ? 'bg-brand/15 text-brand' : 'text-ink'
              const hasRecords = d.records.length > 0
              return (
                <button
                  key={d.key}
                  type="button"
                  role="gridcell"
                  data-no-tag=""
                  aria-selected={isSelected}
                  aria-label={`${d.day}${d.payday ? ', payday' : ''}${d.billsPaid.length ? `, ${d.billsPaid.length} bill paid` : ''}${d.billsDue.length ? `, ${d.billsDue.length} bill due` : ''}${hasRecords ? `, ${d.records.length} records` : ''}`}
                  onClick={() => setSelected(d.key)}
                  className={[
                    'relative flex aspect-square flex-col items-center justify-center rounded-lg transition-colors sm:aspect-[1/0.9]',
                    fill,
                    d.billsDue.length ? 'ring-1 ring-inset ring-warning' : '',
                    isSelected ? 'outline outline-2 outline-offset-1 outline-brand' : 'hover:bg-panel-2',
                  ].join(' ')}
                >
                  <span className={`tabular-nums ${d.key === todayKey ? 'flex h-6 w-6 items-center justify-center rounded-full bg-brand font-bold text-brand-ink' : 'font-semibold'}`}>
                    {d.day}
                  </span>
                  {(d.spentMinor > 0 || d.receivedMinor > 0) && (
                    // Both, when both happened: received on top, spent below.
                    <span className="mt-0.5 hidden flex-col items-center gap-0.5 text-[10px] leading-none tabular-nums sm:flex">
                      {d.receivedMinor > 0 && <span className="text-success">+{compact(d.receivedMinor, currency)}</span>}
                      {d.spentMinor > 0 && <span className="text-danger">−{compact(d.spentMinor, currency)}</span>}
                    </span>
                  )}
                  {hasRecords && (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-muted sm:hidden" aria-hidden="true" />
                  )}
                </button>
              )
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
            {LEGEND.map((l) => (
              <span key={l.label} className="inline-flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded ${l.className}`} /> {l.label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-brand" /> Today
            </span>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="stat-tile">
              <p className="text-[11px] text-muted">Received</p>
              <p className="text-sm font-semibold tabular-nums text-success">{formatMoney(month.receivedMinor, currency)}</p>
            </div>
            <div className="stat-tile">
              <p className="text-[11px] text-muted">Spent</p>
              <p className="text-sm font-semibold tabular-nums text-danger">{formatMoney(month.spentMinor, currency)}</p>
            </div>
            <div className="stat-tile">
              <p className="text-[11px] text-muted">{net >= 0 ? 'Left this month' : 'Over this month'}</p>
              <p className={`inline-flex items-center gap-1 text-sm font-semibold tabular-nums ${net >= 0 ? 'text-success' : 'text-danger'}`}>
                {net >= 0 && <IconCheck size={14} />}
                {formatMoney(Math.abs(net), currency)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 lg:sticky lg:top-[calc(var(--header-h,4rem)+1rem)]">
          <h2 className="font-bold text-ink">
            {day
              ? new Date(cursor.year, cursor.month - 1, day.day).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
              : 'Pick a day'}
          </h2>
          {day && (
            <div className="mt-3 space-y-4 text-sm">
              {day.payday && (
                <p className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 font-medium text-success">
                  <IconWallet size={16} /> Payday
                </p>
              )}

              {day.billsDue.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-warning">Bills due</h3>
                  <ul className="mt-1.5 space-y-1.5">
                    {day.billsDue.map((b) => (
                      <li key={b.id} className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-ink">{b.name}</span>
                        <span className="shrink-0 tabular-nums text-muted">
                          {b.expectedAmountMinor ? `~${formatMoney(b.expectedAmountMinor, currency)}` : 'Due'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {day.billsPaid.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-brand">Bills paid</h3>
                  <ul className="mt-1.5 space-y-1.5">
                    {day.billsPaid.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5 text-ink">
                          <IconCheck size={14} className="shrink-0 text-brand" />
                          <span className="truncate">{t.title}</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-ink">{formatMoney(t.amountMinor, t.currency)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {day.records.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Records</h3>
                  <ul className="mt-1.5 space-y-1.5">
                    {day.records.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5 text-ink">
                          {t.type === 'INCOME' ? (
                            <IconArrowUpRight size={14} className="shrink-0 text-success" />
                          ) : t.type === 'EXPENSE' ? (
                            <IconArrowDownRight size={14} className="shrink-0 text-danger" />
                          ) : (
                            <IconReceipt size={14} className="shrink-0 text-muted" />
                          )}
                          <span className="truncate">{t.title}</span>
                        </span>
                        <span
                          className={`shrink-0 tabular-nums ${t.type === 'INCOME' ? 'text-success' : t.type === 'EXPENSE' ? 'text-danger' : 'text-muted'}`}
                        >
                          {t.type === 'INCOME' ? '+' : t.type === 'EXPENSE' ? '−' : ''}
                          {formatMoney(t.amountMinor, t.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {!day.payday && !day.billsDue.length && !day.billsPaid.length && !day.records.length && (
                <p className="text-muted">
                  Nothing on this day.{' '}
                  {day.key <= todayKey && (
                    <Link to="/" className="font-medium text-brand underline">
                      Add a record
                    </Link>
                  )}
                </p>
              )}
            </div>
          )}
          {!user?.paydays?.length && (
            <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
              Add your paydays on your{' '}
              <Link to="/account" className="font-medium text-brand underline">
                Account
              </Link>{' '}
              page to see them here.
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}

export default Calendar
