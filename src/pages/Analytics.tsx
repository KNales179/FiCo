import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSpace } from '../hooks/useSpace'
import { useAuth } from '../hooks/useAuth'
import { useBills } from '../hooks/useBills'
import { useAllTransactions } from '../hooks/useAllTransactions'
import { listMembers } from '../services/spaceService'
import {
  computeAnalytics,
  type Analytics as AnalyticsData,
} from '../features/analytics'
import { computeEngagement, type MemberEngagement } from '../features/engagement'
import type { AnalyticsPeriod } from '../domain/analytics'
import { compareElectricityPeriods } from '../domain/electricity'
import { formatUsage, recordKindOf, sumByPeriod, USAGE, USAGE_KINDS } from '../features/bills/usage'
import { formatMoney } from '../domain/money'
import { shortMonth, longMonth } from '../domain/insights'
import type { SpaceMember } from '../types/space'
import { PageHeader, Select } from '../components/ui'
import {
  AreaChart,
  BarChart,
  CountUp,
  DonutChart,
  EmptyChart,
  RankedBars,
} from '../components/charts'
import { CATEGORY_COLORS, OTHER_COLOR } from '../components/charts/palette'
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconAward,
  IconCart,
  IconChart,
  IconReceipt,
  IconUsers,
  IconWallet,
} from '../components/icons'
import { gsap, prefersReducedMotion, useStaggerIn } from '../lib/motion'
import Approx from '../components/Approx'

const PERIODS: { value: AnalyticsPeriod; label: string }[] = [
  { value: 'THIS_MONTH', label: 'This month' },
  { value: 'LAST_MONTH', label: 'Last month' },
  { value: 'THIS_YEAR', label: 'This year' },
  { value: 'LAST_YEAR', label: 'Last year' },
  { value: 'ALL_TIME', label: 'All time' },
]

/** Percent-change badge — up in red, down in green, "—" when there's nothing to compare against. */
const PctChange = ({ pct }: { pct: number | null }) => {
  if (pct == null) return <span className="text-muted">—</span>
  const rounded = Math.round(pct)
  if (rounded === 0) return <span className="text-muted">steady</span>
  const up = rounded > 0
  return (
    <span className={`inline-flex items-center gap-0.5 ${up ? 'text-danger' : 'text-success'}`}>
      {up ? <IconArrowUpRight size={12} /> : <IconArrowDownRight size={12} />}
      {Math.abs(rounded)}%
    </span>
  )
}

/**
 * The opening: a short branded "crunching numbers" moment — bars rising and
 * settling — before the page's content eases in. It lasts at least ~0.9s
 * (or as long as the numbers take), and is skipped for anyone who asked
 * their device for less motion.
 */
const Intro = () => {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    const bars = el.querySelectorAll('[data-intro-bar]')
    const tl = gsap.timeline()
    tl.from(el, { autoAlpha: 0, scale: 0.96, duration: 0.3, ease: 'power2.out' })
      .from(bars, { scaleY: 0, transformOrigin: '50% 100%', duration: 0.45, ease: 'back.out(2)', stagger: 0.08 }, 0.1)
      .to(bars, { scaleY: 0.55, transformOrigin: '50% 100%', duration: 0.35, ease: 'sine.inOut', stagger: { each: 0.08, repeat: -1, yoyo: true } }, '>')
    return () => {
      tl.kill()
    }
  }, [])
  return (
    <div ref={ref} className="flex min-h-[45vh] flex-col items-center justify-center gap-4" role="status" aria-label="Loading analytics">
      <div className="flex h-16 items-end gap-2">
        {[38, 58, 46, 64].map((h, i) => (
          <span key={i} data-intro-bar="" className="w-3.5 rounded-t-md bg-brand" style={{ height: h, opacity: 0.55 + i * 0.15 }} />
        ))}
      </div>
      <p className="text-sm font-medium text-muted">Crunching your numbers…</p>
    </div>
  )
}

const StatTile = ({
  label,
  value,
  currency,
  icon,
  tone,
}: {
  label: string
  value: number
  currency: string
  icon: ReactNode
  tone?: 'success' | 'danger'
}) => {
  const format = useCallback((n: number) => formatMoney(n, currency), [currency])
  return (
    <div className="card">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
        {icon}
        {label}
      </p>
      <p
        className={`mt-1 break-words text-xl font-bold tabular-nums sm:text-2xl ${
          tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-ink'
        }`}
      >
        <CountUp value={value} format={format} />
      </p>
      <Approx minor={value} currency={currency} />
    </div>
  )
}

const Analytics = () => {
  const { activeSpaceId, activeSpace } = useSpace()
  const { user } = useAuth()
  const { electricity } = useBills()
  const transactions = useAllTransactions()
  const currency = activeSpace?.currency ?? 'PHP'
  const [period, setPeriod] = useState<AnalyticsPeriod>('THIS_MONTH')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<Map<string, SpaceMember>>(new Map())
  const [engagement, setEngagement] = useState<MemberEngagement[]>([])
  const [introOver, setIntroOver] = useState(() => prefersReducedMotion())
  const contentRef = useRef<HTMLDivElement>(null)
  // "Today" for this visit — the daily chart stops here rather than
  // showing the rest of the month as empty days.
  const [openedAt] = useState(() => Date.now())

  useEffect(() => {
    if (introOver) return
    const t = setTimeout(() => setIntroOver(true), 900)
    return () => clearTimeout(t)
  }, [introOver])

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)

    const run = async () => {
      const result = activeSpaceId
        ? await computeAnalytics(activeSpaceId, period, undefined, currency)
        : null
      if (!cancelled) {
        setData(result)
        setLoading(false)
      }
    }
    void run()

    return () => {
      cancelled = true
    }
  }, [activeSpaceId, period, currency])

  useEffect(() => {
    if (!activeSpaceId) return
    listMembers(activeSpaceId)
      .then((res) => {
        setMembers(new Map(res.members.map((m) => [m.userId, m])))
      })
      // Names are a nice-to-have here — offline or a hiccup just falls
      // back to a generic label rather than breaking the page.
      .catch(() => {})
  }, [activeSpaceId])

  useEffect(() => {
    let cancelled = false
    if (!activeSpaceId || !data) return

    computeEngagement(activeSpaceId, data.range)
      .then((result) => {
        if (!cancelled) setEngagement(result)
      })
      .catch(() => {
        if (!cancelled) setEngagement([])
      })

    return () => {
      cancelled = true
    }
  }, [activeSpaceId, data])

  const memberName = (userId: string) =>
    userId === user?.id
      ? 'You'
      : members.get(userId)?.displayName || members.get(userId)?.username || 'Someone'

  // Category colours follow the category, not its rank in this period: the
  // six biggest categories of all time own one colour each, everything
  // else folds into "Other" — so switching the period never repaints a
  // slice that's still on screen.
  const categoryColor = useMemo(() => {
    const totals = new Map<string, number>()
    for (const t of transactions) {
      if (t.type !== 'EXPENSE' || t.currency !== currency) continue
      const name = t.categoryName || 'Uncategorized'
      totals.set(name, (totals.get(name) ?? 0) + t.amountMinor)
    }
    const order = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n)
    return new Map(order.slice(0, 6).map((n, i) => [n, CATEGORY_COLORS[i]]))
  }, [transactions, currency])

  const donutSlices = useMemo(() => {
    if (!data) return []
    let other = 0
    const named: { label: string; value: number; color: string }[] = []
    for (const c of data.byCategory) {
      const color = categoryColor.get(c.name)
      if (color) named.push({ label: c.name, value: c.amountMinor, color })
      else other += c.amountMinor
    }
    return other > 0 ? [...named, { label: 'Other', value: other, color: OTHER_COLOR }] : named
  }, [data, categoryColor])

  // Over time: day by day for a month-sized range, month by month beyond.
  const overTime = useMemo(() => {
    if (!data) return null
    const from = new Date(data.range.fromIso)
    const end = Math.min(openedAt, new Date(data.range.toIso).getTime())
    const days = Math.max(1, Math.floor((end - from.getTime()) / 86_400_000) + 1)
    if (days <= 62) {
      const perDay = new Map<string, number>()
      for (const t of transactions) {
        if (t.type !== 'EXPENSE' || t.currency !== currency) continue
        if (t.occurredAt < data.range.fromIso || t.occurredAt > data.range.toIso) continue
        const k = t.occurredAt.slice(0, 10)
        perDay.set(k, (perDay.get(k) ?? 0) + t.amountMinor)
      }
      const points = Array.from({ length: days }, (_, i) => {
        const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + i))
        const key = d.toISOString().slice(0, 10)
        return {
          key,
          label: String(d.getUTCDate()),
          title: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }),
          value: perDay.get(key) ?? 0,
        }
      })
      let running = 0
      const cumulative = points.map((p) => ({ ...p, value: (running += p.value) }))
      return { kind: 'daily' as const, points, cumulative }
    }
    return {
      kind: 'monthly' as const,
      months: data.byMonth.map((m) => ({
        key: m.month,
        label: shortMonth(m.month),
        title: longMonth(m.month),
        values: [m.incomeMinor, m.expenseMinor],
      })),
    }
  }, [data, transactions, currency, openedAt])

  // Electricity specifically — not "bills in general": a FIXED bill's
  // amount never moves, but electricity's amount *and* consumption both
  // move on their own, and telling them apart is the useful part.
  // …and the same for water (m³), LPG (kg) and fuel (L), when tracked.
  const usageTrends = useMemo(
    () =>
      USAGE_KINDS.map((kind) => ({
        kind,
        trend: compareElectricityPeriods(sumByPeriod(electricity.filter((r) => recordKindOf(r) === kind)))
          .slice(-6)
          .reverse(),
      })).filter((u) => u.trend.length > 0),
    [electricity],
  )

  const ready = introOver && !loading && data !== null
  useStaggerIn(contentRef, ready ? `${period}-${activeSpaceId}` : null, { y: 18, stagger: 0.07 })

  return (
    <div className="space-y-4">
      <PageHeader
        icon={IconChart}
        title="Analytics"
        description="Where your money came from and where it went."
        actions={
          <span data-tour="analytics-period">
            <Select
              value={period}
              onChange={(e) => setPeriod(e.target.value as AnalyticsPeriod)}
              className="w-auto"
              aria-label="Period"
            >
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </span>
        }
      />

      {!ready && <Intro />}

      {ready && data && (
        <div ref={contentRef} className="space-y-4">
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-tour="analytics-totals">
            <StatTile label="Income" value={data.incomeMinor} currency={data.currency} tone="success" icon={<IconArrowUpRight size={14} />} />
            <StatTile label="Expenses" value={data.expenseMinor} currency={data.currency} tone="danger" icon={<IconArrowDownRight size={14} />} />
            <StatTile label="Net" value={data.netMinor} currency={data.currency} tone={data.netMinor < 0 ? 'danger' : undefined} icon={<IconWallet size={14} />} />
            <StatTile label="Bills paid" value={data.billSpendMinor} currency={data.currency} icon={<IconReceipt size={14} />} />
          </section>

          {data.incomeMinor > 0 && (
            <section className="card">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="section-title">Spent {Math.round(data.expensePctOfIncome)}% of income</h2>
                <span className="text-xs text-muted">
                  {data.netMinor >= 0
                    ? `${formatMoney(data.netMinor, data.currency)} left over`
                    : `${formatMoney(-data.netMinor, data.currency)} over`}
                </span>
              </div>
              <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-panel-2">
                <div
                  className={`h-3 rounded-full ${data.expensePctOfIncome > 100 ? 'bg-danger' : 'bg-brand'}`}
                  style={{ width: `${Math.min(Math.max(data.expensePctOfIncome, 0), 100)}%` }}
                />
              </div>
            </section>
          )}

          <div className="grid items-start gap-4 lg:grid-cols-2">
            <section className="card min-w-0 lg:col-span-2" data-tour="analytics-trend">
              <h2 className="section-title flex items-center gap-2">
                <span className="card-icon">
                  <IconChart size={16} />
                </span>
                {overTime?.kind === 'monthly' ? 'Income vs expenses by month' : 'Spending day by day'}
              </h2>
              <div className="mt-4">
                {overTime?.kind === 'daily' ? (
                  overTime.points.some((p) => p.value > 0) ? (
                    <div className="grid gap-6 xl:grid-cols-2">
                      <div className="min-w-0">
                        <p className="mb-1 text-xs font-medium text-muted">Each day</p>
                        <BarChart
                          ariaLabel="Spending per day"
                          data={overTime.points.map((p) => ({ key: p.key, label: p.label, title: p.title, values: [p.value] }))}
                          series={[{ name: 'Spent', color: 'var(--brand)' }]}
                          currency={data.currency}
                          height={190}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="mb-1 text-xs font-medium text-muted">Running total</p>
                        <AreaChart
                          ariaLabel="Running total of spending"
                          points={overTime.cumulative}
                          currency={data.currency}
                          height={190}
                        />
                      </div>
                    </div>
                  ) : (
                    <EmptyChart>No spending in this period.</EmptyChart>
                  )
                ) : overTime && overTime.months.length > 0 ? (
                  <BarChart
                    ariaLabel="Income and expenses per month"
                    data={overTime.months}
                    series={[
                      { name: 'Income', color: 'var(--success)' },
                      { name: 'Expenses', color: 'var(--danger)' },
                    ]}
                    currency={data.currency}
                    height={220}
                  />
                ) : (
                  <EmptyChart>Nothing recorded in this period.</EmptyChart>
                )}
              </div>
            </section>

            <section className="card min-w-0" data-tour="analytics-categories">
              <h2 className="section-title">Spending by category</h2>
              <div className="mt-4">
                {donutSlices.length === 0 ? (
                  <EmptyChart>No expenses in this period.</EmptyChart>
                ) : (
                  <DonutChart
                    slices={donutSlices}
                    currency={data.currency}
                    centerLabel="Spent"
                    centerValue={formatMoney(data.expenseMinor, data.currency)}
                  />
                )}
              </div>
            </section>

            <section className="card min-w-0">
              <h2 className="section-title">Biggest categories</h2>
              <p className="mt-1 text-xs text-muted">Ranked by amount spent this period.</p>
              <div className="mt-3">
                {data.byCategory.length === 0 ? (
                  <EmptyChart>No expenses in this period.</EmptyChart>
                ) : (
                  <RankedBars
                    rows={data.byCategory.map((c) => ({ label: c.name, value: c.amountMinor, note: `${Math.round(c.pct)}%` }))}
                    currency={data.currency}
                  />
                )}
              </div>
            </section>

            {data.byMember.length > 1 && (
              <section className="card min-w-0">
                <h2 className="section-title flex items-center gap-2">
                  <span className="card-icon">
                    <IconUsers size={16} />
                  </span>
                  Spending by person
                </h2>
                <p className="mt-1 text-xs text-muted">Who recorded the expense, not who it was for.</p>
                <div className="mt-3">
                  <RankedBars
                    rows={data.byMember.map((m) => ({ label: memberName(m.userId), value: m.amountMinor, note: `${Math.round(m.pct)}%` }))}
                    currency={data.currency}
                  />
                </div>
              </section>
            )}

            {engagement.length > 1 && (
              <section className="card min-w-0">
                <h2 className="section-title flex items-center gap-2">
                  <span className="card-icon">
                    <IconAward size={16} />
                  </span>
                  Active points
                </h2>
                <p className="mt-1 text-xs text-muted">
                  How much each of you actually used Fico this period: recording
                  transactions, starting to-buy lists, adding and paying bills.
                </p>
                <ul className="mt-3 space-y-3">
                  {engagement.map((e) => {
                    const member = members.get(e.userId)
                    const initial = (member?.displayName || member?.username || '?').charAt(0).toUpperCase()
                    const max = Math.max(1, engagement[0].points)
                    return (
                      <li key={e.userId} className="flex items-center gap-3">
                        {member?.avatarUrl ? (
                          <img src={member.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                        ) : (
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-ink">
                            {initial}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between text-sm">
                            <span>{memberName(e.userId)}</span>
                            <span className="font-semibold text-ink">{e.points} pts</span>
                          </div>
                          <div className="mt-1 h-2 w-full rounded-full bg-panel-2">
                            <div className="h-2 rounded-full bg-brand" style={{ width: `${(e.points / max) * 100}%` }} />
                          </div>
                          <p className="mt-1 text-xs text-muted">
                            {e.transactionsRecorded} transaction{e.transactionsRecorded === 1 ? '' : 's'} ·{' '}
                            {e.shoppingListsStarted} shopping trip{e.shoppingListsStarted === 1 ? '' : 's'} ·{' '}
                            {e.billsAdded + e.billsPaid} bill action{e.billsAdded + e.billsPaid === 1 ? '' : 's'}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            <section className="card min-w-0">
              <h2 className="section-title flex items-center gap-2">
                <span className="card-icon">
                  <IconCart size={16} />
                </span>
                To-buy lists
              </h2>
              <p className="mt-1 text-xs text-muted">
                {data.shopping.listCount} completed list{data.shopping.listCount === 1 ? '' : 's'} this period.
              </p>
              <div className="mt-3">
                {data.shopping.listCount > 0 ? (
                  <BarChart
                    ariaLabel="To-buy lists: planned versus actually spent"
                    data={[{ key: 'shop', label: 'This period', values: [data.shopping.plannedMinor, data.shopping.actualMinor] }]}
                    series={[
                      { name: 'Planned', color: 'var(--chart-1)' },
                      { name: 'Actually spent', color: 'var(--chart-2)' },
                    ]}
                    currency={data.currency}
                    height={150}
                  />
                ) : (
                  <EmptyChart>Finish a to-buy list to compare planned vs actual.</EmptyChart>
                )}
              </div>
            </section>

            {usageTrends.map(({ kind, trend: electricityTrend }) => (
              <section key={kind} className="card min-w-0 lg:col-span-2">
                <h2 className="section-title">{USAGE[kind].label}</h2>
                <p className="mt-1 text-xs text-muted">
                  Amount up but {USAGE[kind].unit} flat means the price went up, not your usage —
                  amount and {USAGE[kind].unit} both up means you're using more.
                </p>
                <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                  <div className="min-w-0">
                    <BarChart
                      ariaLabel={`${USAGE[kind].label} cost per billing period`}
                      data={[...electricityTrend].reverse().map((r) => ({
                        key: r.billingPeriod,
                        label: r.billingPeriod.length === 7 ? shortMonth(r.billingPeriod) : r.billingPeriod.slice(5),
                        title: `${r.billingPeriod}${r.consumptionKwh != null ? ` · ${formatUsage(r.consumptionKwh, kind)}` : ''}`,
                        values: [r.amountMinor],
                      }))}
                      series={[{ name: 'Cost', color: 'var(--brand)' }]}
                      height={170}
                    />
                  </div>
                  <div className="table-wrap min-w-0">
                    <table className="table text-xs">
                      <thead>
                        <tr>
                          <th>Period</th>
                          <th className="text-right">Amount</th>
                          <th className="text-right">vs last</th>
                          <th className="text-right">{USAGE[kind].unit}</th>
                          <th className="text-right">vs last</th>
                        </tr>
                      </thead>
                      <tbody>
                        {electricityTrend.map((r) => (
                          <tr key={r.billingPeriod}>
                            <td>{r.billingPeriod}</td>
                            <td className="text-right tabular-nums">{formatMoney(r.amountMinor)}</td>
                            <td className="text-right">
                              <PctChange pct={r.amountVsPriorPct} />
                            </td>
                            <td className="text-right tabular-nums">{r.consumptionKwh ?? '—'}</td>
                            <td className="text-right">
                              <PctChange pct={r.kwhVsPriorPct} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            ))}
          </div>

          <p className="text-xs text-muted">
            {data.transactionCount} transactions ·{' '}
            {new Date(data.range.fromIso).toLocaleDateString()} –{' '}
            {new Date(data.range.toIso).toLocaleDateString()}
            {data.fromCache && ' · offline (local estimate)'}
          </p>
        </div>
      )}
    </div>
  )
}

export default Analytics
