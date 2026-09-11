import { useEffect, useMemo, useState } from 'react'
import { useSpace } from '../hooks/useSpace'
import { useAuth } from '../hooks/useAuth'
import { useBills } from '../hooks/useBills'
import { listMembers } from '../services/spaceService'
import {
  computeAnalytics,
  type Analytics as AnalyticsData,
} from '../features/analytics'
import type { AnalyticsPeriod } from '../domain/analytics'
import { compareElectricityPeriods } from '../domain/electricity'
import { formatMoney } from '../domain/money'

const PERIODS: { value: AnalyticsPeriod; label: string }[] = [
  { value: 'THIS_MONTH', label: 'This month' },
  { value: 'LAST_MONTH', label: 'Last month' },
  { value: 'THIS_YEAR', label: 'This year' },
  { value: 'LAST_YEAR', label: 'Last year' },
  { value: 'ALL_TIME', label: 'All time' },
]

const Bar = ({
  pct,
  className = 'bg-gray-800',
}: {
  pct: number
  className?: string
}) => (
  <div className="h-2 w-full rounded bg-gray-100">
    <div
      className={`h-2 rounded ${className}`}
      style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
    />
  </div>
)

/** Percent-change badge — up in red, down in green, "—" when there's nothing to compare against. */
const PctChange = ({ pct }: { pct: number | null }) => {
  if (pct == null) return <span className="text-muted">—</span>
  const rounded = Math.round(pct)
  if (rounded === 0) return <span className="text-muted">steady</span>
  const up = rounded > 0
  return (
    <span className={up ? 'text-danger' : 'text-success'}>
      {up ? '↑' : '↓'} {Math.abs(rounded)}%
    </span>
  )
}

const Analytics = () => {
  const { activeSpaceId } = useSpace()
  const { user } = useAuth()
  const { electricity } = useBills()
  const [period, setPeriod] = useState<AnalyticsPeriod>('THIS_MONTH')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [memberNames, setMemberNames] = useState<Map<string, string>>(
    new Map(),
  )

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)

    const run = async () => {
      const result = activeSpaceId
        ? await computeAnalytics(activeSpaceId, period)
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
  }, [activeSpaceId, period])

  useEffect(() => {
    if (!activeSpaceId) return
    listMembers(activeSpaceId)
      .then((res) => {
        setMemberNames(
          new Map(
            res.members.map((m) => [
              m.userId,
              m.displayName || m.username || 'Someone',
            ]),
          ),
        )
      })
      // Names are a nice-to-have here — offline or a hiccup just falls
      // back to showing the raw id rather than breaking the page.
      .catch(() => {})
  }, [activeSpaceId])

  const maxMonth = useMemo(
    () =>
      data
        ? Math.max(
            1,
            ...data.byMonth.map((m) =>
              Math.max(m.incomeMinor, m.expenseMinor),
            ),
          )
        : 1,
    [data],
  )

  // Electricity specifically — not "bills in general": a FIXED bill's
  // amount never moves, so there's nothing to compare month to month, but
  // electricity's amount *and* consumption both move independently, and
  // most recent first is more useful here than the trip down memory lane.
  const electricityTrend = useMemo(
    () => compareElectricityPeriods(electricity).slice(-6).reverse(),
    [electricity],
  )

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as AnalyticsPeriod)}
          className="border px-2 py-1 text-sm"
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="text-sm text-muted">Loading…</p>}

      {data && !loading && (
        <>
          <section className="grid grid-cols-3 gap-3">
            <div className="card">
              <div className="text-xs text-muted">Income</div>
              <div className="text-lg font-semibold text-success">
                {formatMoney(data.incomeMinor, data.currency)}
              </div>
            </div>
            <div className="card">
              <div className="text-xs text-muted">Expenses</div>
              <div className="text-lg font-semibold text-danger">
                {formatMoney(data.expenseMinor, data.currency)}
              </div>
            </div>
            <div className="card">
              <div className="text-xs text-muted">Net</div>
              <div
                className={`text-lg font-semibold ${
                  data.netMinor < 0 ? 'text-danger' : ''
                }`}
              >
                {formatMoney(data.netMinor, data.currency)}
              </div>
            </div>
          </section>

          {data.incomeMinor > 0 && (
            <section className="card">
              <h2 className="text-sm font-semibold">
                Spent {Math.round(data.expensePctOfIncome)}% of income
              </h2>
              <div className="mt-2">
                <Bar
                  pct={data.expensePctOfIncome}
                  className={
                    data.expensePctOfIncome > 100
                      ? 'bg-red-600'
                      : 'bg-gray-800'
                  }
                />
              </div>
              <p className="mt-1 text-xs text-muted">
                {data.netMinor >= 0
                  ? `${formatMoney(data.netMinor, data.currency)} left over`
                  : `${formatMoney(-data.netMinor, data.currency)} over`}
              </p>
            </section>
          )}

          <section className="card">
            <h2 className="text-sm font-semibold">Spending by category</h2>
            {data.byCategory.length === 0 ? (
              <p className="mt-2 text-xs text-muted">No expenses.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {data.byCategory.map((c) => (
                  <li key={c.name} className="text-sm">
                    <div className="flex justify-between">
                      <span>{c.name}</span>
                      <span className="text-muted">
                        {formatMoney(c.amountMinor, data.currency)} ·{' '}
                        {Math.round(c.pct)}%
                      </span>
                    </div>
                    <Bar pct={c.pct} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {data.byMember.length > 1 && (
            <section className="card">
              <h2 className="text-sm font-semibold">Spending by person</h2>
              <p className="mt-1 text-xs text-muted">
                Who recorded the expense, not who it was for.
              </p>
              <ul className="mt-3 space-y-2">
                {data.byMember.map((m) => (
                  <li key={m.userId} className="text-sm">
                    <div className="flex justify-between">
                      <span>
                        {m.userId === user?.id
                          ? 'You'
                          : memberNames.get(m.userId) ?? 'Someone'}
                      </span>
                      <span className="text-muted">
                        {formatMoney(m.amountMinor, data.currency)} ·{' '}
                        {Math.round(m.pct)}%
                      </span>
                    </div>
                    <Bar pct={m.pct} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {electricityTrend.length > 0 && (
            <section className="card">
              <h2 className="text-sm font-semibold">Electricity</h2>
              <p className="mt-1 text-xs text-muted">
                A fixed bill's amount never moves, so there's nothing to
                track there — electricity's amount and usage each move on
                their own, and telling them apart is the useful part.
              </p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-left text-muted">
                    <tr>
                      <th className="py-1 pr-2">Period</th>
                      <th className="py-1 pr-2 text-right">Amount</th>
                      <th className="py-1 pr-2 text-right">vs last month</th>
                      <th className="py-1 pr-2 text-right">kWh</th>
                      <th className="py-1 pr-2 text-right">vs last month</th>
                      <th className="py-1 text-right">vs last year</th>
                    </tr>
                  </thead>
                  <tbody>
                    {electricityTrend.map((r) => (
                      <tr key={r.billingPeriod} className="border-t">
                        <td className="py-1 pr-2">{r.billingPeriod}</td>
                        <td className="py-1 pr-2 text-right">
                          {formatMoney(r.amountMinor)}
                        </td>
                        <td className="py-1 pr-2 text-right">
                          <PctChange pct={r.amountVsPriorPct} />
                        </td>
                        <td className="py-1 pr-2 text-right">
                          {r.consumptionKwh ?? '—'}
                        </td>
                        <td className="py-1 pr-2 text-right">
                          <PctChange pct={r.kwhVsPriorPct} />
                        </td>
                        <td className="py-1 text-right">
                          {r.amountVsLastYearPct == null &&
                          r.kwhVsLastYearPct == null ? (
                            <span className="text-muted">—</span>
                          ) : (
                            <span className="inline-flex gap-1">
                              <PctChange pct={r.amountVsLastYearPct} />
                              <span className="text-muted">/</span>
                              <PctChange pct={r.kwhVsLastYearPct} />
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-muted">
                Amount up but kWh flat means the rate went up, not your
                usage — amount and kWh both up means you're using more.
              </p>
            </section>
          )}

          {data.byMonth.length > 1 && (
            <section className="card">
              <h2 className="text-sm font-semibold">Income vs expenses</h2>
              <ul className="mt-3 space-y-2 text-xs">
                {data.byMonth.map((m) => (
                  <li key={m.month}>
                    <div className="text-muted">{m.month}</div>
                    <div className="flex items-center gap-2">
                      <span className="w-10 text-right text-success">in</span>
                      <Bar
                        pct={(m.incomeMinor / maxMonth) * 100}
                        className="bg-green-600"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-10 text-right text-danger">out</span>
                      <Bar
                        pct={(m.expenseMinor / maxMonth) * 100}
                        className="bg-red-500"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="grid grid-cols-2 gap-3 text-sm">
            <div className="card">
              <div className="text-xs text-muted">Bills paid</div>
              <div className="font-semibold">
                {formatMoney(data.billSpendMinor, data.currency)}
              </div>
            </div>
            <div className="card">
              <div className="text-xs text-muted">
                Shopping ({data.shopping.listCount} lists)
              </div>
              <div className="font-semibold">
                {formatMoney(data.shopping.actualMinor, data.currency)}
              </div>
              {data.shopping.plannedMinor > 0 && (
                <div className="text-xs text-muted">
                  planned{' '}
                  {formatMoney(data.shopping.plannedMinor, data.currency)}
                </div>
              )}
            </div>
          </section>

          <p className="text-xs text-gray-400">
            {data.transactionCount} transactions ·{' '}
            {new Date(data.range.fromIso).toLocaleDateString()} –{' '}
            {new Date(data.range.toIso).toLocaleDateString()}
            {data.fromCache && ' · offline (local estimate)'}
          </p>
        </>
      )}
    </div>
  )
}

export default Analytics
