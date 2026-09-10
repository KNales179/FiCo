import { useEffect, useMemo, useState } from 'react'
import { useSpace } from '../hooks/useSpace'
import {
  computeAnalytics,
  type Analytics as AnalyticsData,
} from '../features/analytics'
import type { AnalyticsPeriod } from '../domain/analytics'
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

const Analytics = () => {
  const { activeSpaceId } = useSpace()
  const [period, setPeriod] = useState<AnalyticsPeriod>('THIS_MONTH')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Analytics</h1>
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

      {loading && <p className="text-sm text-gray-500">Loading…</p>}

      {data && !loading && (
        <>
          <section className="grid grid-cols-3 gap-3">
            <div className="rounded border p-3">
              <div className="text-xs text-gray-500">Income</div>
              <div className="text-lg font-semibold text-green-700">
                {formatMoney(data.incomeMinor, data.currency)}
              </div>
            </div>
            <div className="rounded border p-3">
              <div className="text-xs text-gray-500">Expenses</div>
              <div className="text-lg font-semibold text-red-600">
                {formatMoney(data.expenseMinor, data.currency)}
              </div>
            </div>
            <div className="rounded border p-3">
              <div className="text-xs text-gray-500">Net</div>
              <div
                className={`text-lg font-semibold ${
                  data.netMinor < 0 ? 'text-red-600' : ''
                }`}
              >
                {formatMoney(data.netMinor, data.currency)}
              </div>
            </div>
          </section>

          {data.incomeMinor > 0 && (
            <section className="rounded border p-4">
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
              <p className="mt-1 text-xs text-gray-500">
                {data.netMinor >= 0
                  ? `${formatMoney(data.netMinor, data.currency)} left over`
                  : `${formatMoney(-data.netMinor, data.currency)} over`}
              </p>
            </section>
          )}

          <section className="rounded border p-4">
            <h2 className="text-sm font-semibold">Spending by category</h2>
            {data.byCategory.length === 0 ? (
              <p className="mt-2 text-xs text-gray-500">No expenses.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {data.byCategory.map((c) => (
                  <li key={c.name} className="text-sm">
                    <div className="flex justify-between">
                      <span>{c.name}</span>
                      <span className="text-gray-500">
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

          {data.byMonth.length > 1 && (
            <section className="rounded border p-4">
              <h2 className="text-sm font-semibold">Income vs expenses</h2>
              <ul className="mt-3 space-y-2 text-xs">
                {data.byMonth.map((m) => (
                  <li key={m.month}>
                    <div className="text-gray-500">{m.month}</div>
                    <div className="flex items-center gap-2">
                      <span className="w-10 text-right text-green-700">in</span>
                      <Bar
                        pct={(m.incomeMinor / maxMonth) * 100}
                        className="bg-green-600"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-10 text-right text-red-600">out</span>
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
            <div className="rounded border p-3">
              <div className="text-xs text-gray-500">Bills paid</div>
              <div className="font-semibold">
                {formatMoney(data.billSpendMinor, data.currency)}
              </div>
            </div>
            <div className="rounded border p-3">
              <div className="text-xs text-gray-500">
                Shopping ({data.shopping.listCount} lists)
              </div>
              <div className="font-semibold">
                {formatMoney(data.shopping.actualMinor, data.currency)}
              </div>
              {data.shopping.plannedMinor > 0 && (
                <div className="text-xs text-gray-500">
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
          </p>
        </>
      )}
    </div>
  )
}

export default Analytics
