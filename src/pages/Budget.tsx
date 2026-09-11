import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSpace } from '../hooks/useSpace'
import { useMutationContext } from '../hooks/useMutationContext'
import {
  allocateBudget,
  nextPeriod,
  type Trend,
} from '../domain/budget'
import {
  getBudgetPlan,
  recommendBudget,
  saveBudgetPlan,
  type BudgetRecommendation,
} from '../features/budget'
import { formatMoney, parseAmountToMinor } from '../domain/money'
import { PageHeader, Card, Button, Input, Alert } from '../components/ui'
import type { BudgetPlanItem } from '../types/models'

const periodLabel = (period: string): string => {
  const [year, month] = period.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

const shiftPeriod = (period: string, delta: number): string => {
  const [year, month] = period.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`
}

const TREND_LABEL: Record<Trend, string> = {
  up: '↑ trending up',
  down: '↓ trending down',
  flat: '→ steady',
}
const TREND_CLASS: Record<Trend, string> = {
  up: 'text-danger',
  down: 'text-success',
  flat: 'text-muted',
}

const Budget = () => {
  const { activeSpaceId } = useSpace()
  const { ctx, canEdit } = useMutationContext()

  const [period, setPeriod] = useState(() => nextPeriod())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const [recommendation, setRecommendation] =
    useState<BudgetRecommendation | null>(null)
  const [incomeInput, setIncomeInput] = useState('')
  const [incomeAuto, setIncomeAuto] = useState(true)
  const [plannedItems, setPlannedItems] = useState<BudgetPlanItem[]>([])
  const [newItemName, setNewItemName] = useState('')
  const [newItemAmount, setNewItemAmount] = useState('')

  const load = useCallback(async () => {
    if (!activeSpaceId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    setSaved(false)
    try {
      const [rec, plan] = await Promise.all([
        recommendBudget(activeSpaceId, period),
        getBudgetPlan(activeSpaceId, period),
      ])
      setRecommendation(rec)
      if (plan?.expectedIncomeMinor != null) {
        setIncomeInput((plan.expectedIncomeMinor / 100).toFixed(2))
        setIncomeAuto(false)
      } else {
        setIncomeInput(
          rec.incomeMinor > 0 ? (rec.incomeMinor / 100).toFixed(2) : '',
        )
        setIncomeAuto(true)
      }
      setPlannedItems(plan?.plannedItems ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load')
    } finally {
      setLoading(false)
    }
  }, [activeSpaceId, period])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const incomeMinor = incomeAuto
    ? recommendation?.incomeMinor ?? 0
    : parseAmountToMinor(incomeInput) ?? 0

  const allocation = useMemo(() => {
    if (!recommendation) return null
    return allocateBudget({
      incomeMinor,
      projectedBills: recommendation.projectedBills,
      plannedItems,
      period,
    })
  }, [recommendation, incomeMinor, plannedItems, period])

  const addPlannedItem = () => {
    const amountMinor = parseAmountToMinor(newItemAmount)
    if (!newItemName.trim() || amountMinor === null || amountMinor <= 0) return
    setPlannedItems((rows) => [
      ...rows,
      { id: crypto.randomUUID(), name: newItemName.trim(), amountMinor },
    ])
    setNewItemName('')
    setNewItemAmount('')
  }

  const removePlannedItem = (id: string) =>
    setPlannedItems((rows) => rows.filter((r) => r.id !== id))

  const save = async () => {
    if (!ctx) return
    setError('')
    try {
      await saveBudgetPlan(ctx, period, {
        expectedIncomeMinor: incomeAuto ? null : parseAmountToMinor(incomeInput),
        plannedItems,
      })
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Budget"
        description="Plan where next month's money goes before it arrives."
        actions={
          <div className="flex items-center gap-1">
            <Button size="sm" onClick={() => setPeriod((p) => shiftPeriod(p, -1))}>
              ←
            </Button>
            <span className="w-32 text-center text-sm font-medium">
              {periodLabel(period)}
            </span>
            <Button size="sm" onClick={() => setPeriod((p) => shiftPeriod(p, 1))}>
              →
            </Button>
          </div>
        }
      />

      {error && <Alert>{error}</Alert>}
      {loading && <p className="muted">Loading…</p>}

      {!loading && recommendation && allocation && (
        <>
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="section-title">Expected income</h2>
              {!incomeAuto && (
                <button
                  type="button"
                  onClick={() => setIncomeAuto(true)}
                  className="text-xs text-muted underline hover:text-ink"
                >
                  use recommended
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-muted">
              {recommendation.incomeMinor > 0
                ? `Recommended from your average income the last few months: ${formatMoney(recommendation.incomeMinor)}.`
                : "Not enough income history yet to recommend a figure — enter what you expect."}
            </p>
            <Input
              value={incomeAuto ? (incomeMinor > 0 ? (incomeMinor / 100).toFixed(2) : '') : incomeInput}
              onChange={(e) => {
                setIncomeInput(e.target.value)
                setIncomeAuto(false)
              }}
              inputMode="decimal"
              placeholder="Expected income"
              className="mt-2"
              disabled={!canEdit}
            />
          </Card>

          <Card>
            <h2 className="section-title">Bills due {periodLabel(period)}</h2>
            {recommendation.projectedBills.length === 0 ? (
              <p className="mt-2 text-sm text-muted">
                No bills projected for this month.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {recommendation.projectedBills.map((bill) => {
                  const trend = recommendation.billTrends[bill.billId]
                  return (
                    <li
                      key={bill.billId}
                      className="flex items-center justify-between py-1.5 text-sm"
                    >
                      <span>
                        {bill.name}
                        {trend && (
                          <span className={`ml-2 text-xs ${TREND_CLASS[trend]}`}>
                            {TREND_LABEL[trend]}
                          </span>
                        )}
                      </span>
                      <span className="tabular-nums">
                        {bill.amountMinor > 0 ? (
                          formatMoney(bill.amountMinor)
                        ) : (
                          <span className="text-warning">not yet known</span>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted">
              Pulled live from your Bills list — update a bill there and this
              updates too.
            </p>
          </Card>

          <Card>
            <h2 className="section-title">Planned for next month</h2>
            <p className="mt-1 text-xs text-muted">
              One-off things you already know are coming — school expenses, a
              trip, anything to set aside for before the weekly budget below.
            </p>
            <ul className="mt-2 divide-y divide-line">
              {plannedItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between py-1.5 text-sm"
                >
                  <span>{item.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">
                      {formatMoney(item.amountMinor)}
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => removePlannedItem(item.id)}
                        className="text-xs text-muted underline hover:text-ink"
                      >
                        remove
                      </button>
                    )}
                  </span>
                </li>
              ))}
              {plannedItems.length === 0 && (
                <li className="py-1.5 text-sm text-muted">Nothing planned yet.</li>
              )}
            </ul>
            {canEdit && (
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="What for?"
                  className="input min-w-[8rem] flex-1"
                />
                <input
                  value={newItemAmount}
                  onChange={(e) => setNewItemAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="Amount"
                  className="input w-28"
                />
                <Button onClick={addPlannedItem}>+ add</Button>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="section-title">The plan</h2>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Expected income</dt>
                <dd className="tabular-nums">{formatMoney(allocation.incomeMinor)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">− Bills</dt>
                <dd className="tabular-nums">{formatMoney(allocation.billsTotalMinor)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">− Planned</dt>
                <dd className="tabular-nums">{formatMoney(allocation.plannedTotalMinor)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-1 font-medium">
                <dt>Left for the month</dt>
                <dd className="tabular-nums">{formatMoney(allocation.remainingMinor)}</dd>
              </div>
              <div className="flex justify-between text-brand">
                <dt className="font-medium">
                  Weekly budget ({allocation.weeks} week{allocation.weeks === 1 ? '' : 's'})
                </dt>
                <dd className="tabular-nums font-semibold">
                  {formatMoney(allocation.weeklyBudgetMinor)}
                </dd>
              </div>
            </dl>

            {allocation.overBudget && (
              <p className="mt-2 text-sm text-danger">
                Bills and planned items alone come to more than the expected
                income — something will need to move or wait.
              </p>
            )}

            {canEdit && (
              <Button variant="primary" onClick={() => void save()} className="mt-3">
                Save plan
              </Button>
            )}
            {saved && <p className="mt-2 text-xs text-success">Saved.</p>}
          </Card>
        </>
      )}
    </div>
  )
}

export default Budget
