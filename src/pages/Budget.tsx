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
  up: '↑ rising',
  down: '↓ falling',
  flat: '→ steady',
}
const TREND_CLASS: Record<Trend, string> = {
  up: 'text-danger',
  down: 'text-success',
  flat: 'text-muted',
}

/** A small add/remove editable list — one-off planned items and weekly staples both use this shape. */
const EditableAmountList = ({
  items,
  onAdd,
  onRemove,
  addPlaceholder,
  emptyLabel,
  amountSuffix = '',
}: {
  items: BudgetPlanItem[]
  onAdd: (name: string, amountMinor: number) => void
  onRemove: (id: string) => void
  addPlaceholder: string
  emptyLabel: string
  amountSuffix?: string
}) => {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')

  const add = () => {
    const amountMinor = parseAmountToMinor(amount)
    if (!name.trim() || amountMinor === null || amountMinor <= 0) return
    onAdd(name.trim(), amountMinor)
    setName('')
    setAmount('')
  }

  return (
    <div>
      <ul className="divide-y divide-line">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between py-1.5 text-sm"
          >
            <span>{item.name}</span>
            <span className="flex items-center gap-2">
              <span className="tabular-nums">
                {formatMoney(item.amountMinor)}
                {amountSuffix}
              </span>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="text-xs text-muted underline hover:text-ink"
              >
                remove
              </button>
            </span>
          </li>
        ))}
        {items.length === 0 && (
          <li className="py-1.5 text-sm text-muted">{emptyLabel}</li>
        )}
      </ul>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={addPlaceholder}
          className="input min-w-[8rem] flex-1"
        />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="Amount"
          className="input w-28"
        />
        <Button size="sm" onClick={add}>
          + add
        </Button>
      </div>
    </div>
  )
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
  const [weeklyStaples, setWeeklyStaples] = useState<BudgetPlanItem[]>([])
  const [includedOverdueBillIds, setIncludedOverdueBillIds] = useState<
    Set<string>
  >(new Set())

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

      // Weekly staples: respect a saved (possibly edited/pruned) list; only
      // pre-fill from the recommendation when nothing's been saved yet.
      setWeeklyStaples(
        plan?.weeklyStaples && plan.weeklyStaples.length > 0
          ? plan.weeklyStaples
          : rec.weeklyCategories.map((w) => ({
              id: crypto.randomUUID(),
              name: w.categoryName,
              amountMinor: w.weeklyMedianMinor,
            })),
      )

      // Overdue bills default to included (they still need paying) unless
      // the person already made a choice and saved it.
      setIncludedOverdueBillIds(
        new Set(
          plan?.includedOverdueBillIds ??
            rec.overdueBills.map((b) => b.billId),
        ),
      )
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

  const includedOverdueBills = useMemo(
    () =>
      (recommendation?.overdueBills ?? []).filter((b) =>
        includedOverdueBillIds.has(b.billId),
      ),
    [recommendation, includedOverdueBillIds],
  )

  const allocation = useMemo(() => {
    if (!recommendation) return null
    return allocateBudget({
      incomeMinor,
      projectedBills: [...recommendation.projectedBills, ...includedOverdueBills],
      plannedItems,
      weeklyStaples,
      period,
    })
  }, [recommendation, incomeMinor, includedOverdueBills, plannedItems, weeklyStaples, period])

  const toggleOverdueBill = (billId: string) =>
    setIncludedOverdueBillIds((prev) => {
      const next = new Set(prev)
      if (next.has(billId)) next.delete(billId)
      else next.add(billId)
      return next
    })

  const addPlannedItem = (name: string, amountMinor: number) =>
    setPlannedItems((rows) => [...rows, { id: crypto.randomUUID(), name, amountMinor }])
  const removePlannedItem = (id: string) =>
    setPlannedItems((rows) => rows.filter((r) => r.id !== id))

  const addStaple = (name: string, amountMinor: number) =>
    setWeeklyStaples((rows) => [...rows, { id: crypto.randomUUID(), name, amountMinor }])
  const removeStaple = (id: string) =>
    setWeeklyStaples((rows) => rows.filter((r) => r.id !== id))

  const save = async () => {
    if (!ctx) return
    setError('')
    try {
      await saveBudgetPlan(ctx, period, {
        expectedIncomeMinor: incomeAuto ? null : parseAmountToMinor(incomeInput),
        plannedItems,
        weeklyStaples,
        includedOverdueBillIds: [...includedOverdueBillIds],
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
          <Card className="space-y-4">
            {/* Income */}
            <div>
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
                  ? `Recommended from your typical income the last few months: ${formatMoney(recommendation.incomeMinor)}.`
                  : 'Not enough income history yet to recommend a figure — enter what you expect.'}
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
            </div>

            {/* Bills */}
            <div className="border-t border-line pt-4">
              <h2 className="section-title">Bills</h2>
              <ul className="mt-2 divide-y divide-line">
                {recommendation.projectedBills.map((bill) => {
                  const trend = recommendation.billTrends[bill.billId]
                  return (
                    <li key={bill.billId} className="flex items-center justify-between py-1.5 text-sm">
                      <span>
                        {bill.name}
                        {trend && (
                          <span className={`ml-2 text-xs ${TREND_CLASS[trend]}`}>
                            {TREND_LABEL[trend]}
                          </span>
                        )}
                      </span>
                      <span className="tabular-nums">
                        {bill.amountMinor > 0 ? formatMoney(bill.amountMinor) : (
                          <span className="text-warning">not yet known</span>
                        )}
                      </span>
                    </li>
                  )
                })}
                {recommendation.projectedBills.length === 0 &&
                  recommendation.paidAheadBills.length === 0 && (
                    <li className="py-1.5 text-sm text-muted">No bills due {periodLabel(period)}.</li>
                  )}
              </ul>

              {recommendation.paidAheadBills.length > 0 && (
                <ul className="mt-1 divide-y divide-line">
                  {recommendation.paidAheadBills.map((bill) => (
                    <li key={bill.billId} className="flex items-center justify-between py-1.5 text-sm">
                      <span>{bill.name}</span>
                      <span className="text-xs text-muted">
                        already paid ahead — next due{' '}
                        {new Date(bill.nextDueDate).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {recommendation.overdueBills.length > 0 && (
                <>
                  <p className="mt-3 text-xs font-medium text-warning">Overdue — include in this plan?</p>
                  <ul className="mt-1 divide-y divide-line">
                    {recommendation.overdueBills.map((bill) => (
                      <li key={bill.billId} className="flex items-center justify-between py-1.5 text-sm">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={includedOverdueBillIds.has(bill.billId)}
                            onChange={() => toggleOverdueBill(bill.billId)}
                          />
                          {bill.name}
                          <span className="text-xs text-muted">
                            (was due {new Date(bill.dueDate).toLocaleDateString()})
                          </span>
                        </label>
                        <span className="tabular-nums">{formatMoney(bill.amountMinor)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            {/* Other planned expenses */}
            <div className="border-t border-line pt-4">
              <h2 className="section-title">Other planned expenses</h2>
              <p className="mt-1 text-xs text-muted">
                One-off things you already know are coming — school expenses, a
                project, a trip.
              </p>
              <div className="mt-2">
                <EditableAmountList
                  items={plannedItems}
                  onAdd={addPlannedItem}
                  onRemove={removePlannedItem}
                  addPlaceholder="What for?"
                  emptyLabel="Nothing planned yet."
                />
              </div>
            </div>

            {/* Weekly staples */}
            <div className="border-t border-line pt-4">
              <h2 className="section-title">Weekly staples</h2>
              <p className="mt-1 text-xs text-muted">
                Groceries, food, and anything else you buy on a regular
                weekly rhythm — recommended from how often you've actually
                bought them, highest first. A rarely-bought thing won't show
                up here on its own.
              </p>
              <div className="mt-2">
                <EditableAmountList
                  items={weeklyStaples}
                  onAdd={addStaple}
                  onRemove={removeStaple}
                  addPlaceholder="Category"
                  emptyLabel="Nothing recognized as a weekly habit yet."
                  amountSuffix="/wk"
                />
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="section-title">The breakdown</h2>
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
                <dt className="text-muted">− Other planned expenses</dt>
                <dd className="tabular-nums">{formatMoney(allocation.plannedTotalMinor)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">
                  − Weekly staples ({formatMoney(allocation.weeklyStaplesTotalMinor)}/wk × {allocation.weeks})
                </dt>
                <dd className="tabular-nums">
                  {formatMoney(allocation.weeklyStaplesTotalMinor * allocation.weeks)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-line pt-1 font-medium">
                <dt>Left over</dt>
                <dd className="tabular-nums">{formatMoney(allocation.remainingMinor)}</dd>
              </div>
              <div className="flex justify-between text-brand">
                <dt className="font-medium">
                  Weekly spending money ({allocation.weeks} wk{allocation.weeks === 1 ? '' : 's'})
                </dt>
                <dd className="tabular-nums font-semibold">
                  {formatMoney(allocation.weeklyBudgetMinor)}
                </dd>
              </div>
              <p className="pl-0 text-xs text-muted">
                = {formatMoney(allocation.weeklyStaplesTotalMinor)}/wk staples +{' '}
                {formatMoney(allocation.weeklyDiscretionaryMinor)}/wk free to spend
              </p>
            </dl>

            {allocation.overBudget && (
              <p className="mt-2 text-sm text-danger">
                Bills, planned items and staples alone come to more than the
                expected income — something will need to move or wait.
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
