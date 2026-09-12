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
import { PageHeader, Card, Button, Input, Alert, SkeletonCard } from '../components/ui'
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

/**
 * A bill's amount in the plan — editable in place. Recommended/projected by
 * default; typing a different figure and leaving the field overrides it for
 * this one bill, this one period (e.g. the real electric bill once it's in
 * hand, instead of the payment-history estimate).
 */
const BillAmountInput = ({
  amountMinor,
  overridden,
  disabled,
  onCommit,
  onReset,
}: {
  amountMinor: number
  overridden: boolean
  disabled: boolean
  onCommit: (amountMinor: number) => void
  onReset: () => void
}) => {
  // Keyed by amountMinor at the call site (below) — a fresh amount (a
  // period switch, an outside reset) remounts this with the right starting
  // value instead of needing an effect to resync it mid-life.
  const [value, setValue] = useState(
    amountMinor > 0 ? (amountMinor / 100).toFixed(2) : '',
  )

  const commit = () => {
    const minor = parseAmountToMinor(value)
    if (minor != null && minor > 0 && minor !== amountMinor) onCommit(minor)
  }

  return (
    <span className="flex items-center gap-1.5">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        inputMode="decimal"
        placeholder={amountMinor > 0 ? undefined : 'not yet known'}
        disabled={disabled}
        className="input w-24 text-right tabular-nums"
      />
      {overridden && !disabled && (
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-muted underline hover:text-ink"
        >
          reset
        </button>
      )}
    </span>
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
  // A VARIABLE bill's recommendation is an estimate from payment history —
  // once the real bill is in hand (electricity's actual amount for next
  // month, say), it can be typed in here instead, per bill per period.
  const [billAmountOverrides, setBillAmountOverrides] = useState<
    Record<string, number>
  >({})

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

      setBillAmountOverrides(plan?.billAmountOverrides ?? {})
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

  // The recommendation is a starting estimate from payment history — once
  // the real amount for a bill is known (this month's actual electric
  // bill, say), an override for that bill takes over here instead.
  const projectedBills = useMemo(
    () =>
      (recommendation?.projectedBills ?? []).map((bill) => ({
        ...bill,
        amountMinor: billAmountOverrides[bill.billId] ?? bill.amountMinor,
      })),
    [recommendation, billAmountOverrides],
  )

  const overdueBills = useMemo(
    () =>
      (recommendation?.overdueBills ?? []).map((bill) => ({
        ...bill,
        amountMinor: billAmountOverrides[bill.billId] ?? bill.amountMinor,
      })),
    [recommendation, billAmountOverrides],
  )

  const includedOverdueBills = useMemo(
    () => overdueBills.filter((b) => includedOverdueBillIds.has(b.billId)),
    [overdueBills, includedOverdueBillIds],
  )

  const allocation = useMemo(() => {
    if (!recommendation) return null
    return allocateBudget({
      incomeMinor,
      projectedBills: [...projectedBills, ...includedOverdueBills],
      plannedItems,
      weeklyStaples,
      period,
    })
  }, [recommendation, incomeMinor, projectedBills, includedOverdueBills, plannedItems, weeklyStaples, period])

  // Bills + planned + staples×weeks — what income would need to be for
  // remainingMinor to land at exactly 0, i.e. the "close the gap" figure.
  const requiredIncomeMinor = allocation
    ? allocation.incomeMinor - allocation.remainingMinor
    : 0

  // Every change below saves itself right away — adding a planned item or a
  // staple, checking an overdue bill, switching the income source — instead
  // of only living in memory until someone remembers to hit "Save plan".
  // Losing an unsaved add by navigating away (or the plan reloading for any
  // other reason) was exactly the "it's suddenly gone" complaint this fixes.
  const persist = async (
    patch: Partial<{
      expectedIncomeMinor: number | null
      plannedItems: BudgetPlanItem[]
      weeklyStaples: BudgetPlanItem[]
      includedOverdueBillIds: string[]
      billAmountOverrides: Record<string, number>
    }>,
  ) => {
    if (!ctx) return
    setError('')
    try {
      await saveBudgetPlan(ctx, period, patch)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    }
  }

  const toggleOverdueBill = (billId: string) =>
    setIncludedOverdueBillIds((prev) => {
      const next = new Set(prev)
      if (next.has(billId)) next.delete(billId)
      else next.add(billId)
      void persist({ includedOverdueBillIds: [...next] })
      return next
    })

  const addPlannedItem = (name: string, amountMinor: number) =>
    setPlannedItems((rows) => {
      const next = [...rows, { id: crypto.randomUUID(), name, amountMinor }]
      void persist({ plannedItems: next })
      return next
    })
  const removePlannedItem = (id: string) =>
    setPlannedItems((rows) => {
      const next = rows.filter((r) => r.id !== id)
      void persist({ plannedItems: next })
      return next
    })

  const addStaple = (name: string, amountMinor: number) =>
    setWeeklyStaples((rows) => {
      const next = [...rows, { id: crypto.randomUUID(), name, amountMinor }]
      void persist({ weeklyStaples: next })
      return next
    })
  const removeStaple = (id: string) =>
    setWeeklyStaples((rows) => {
      const next = rows.filter((r) => r.id !== id)
      void persist({ weeklyStaples: next })
      return next
    })

  const setBillOverride = (billId: string, amountMinor: number) =>
    setBillAmountOverrides((prev) => {
      const next = { ...prev, [billId]: amountMinor }
      void persist({ billAmountOverrides: next })
      return next
    })

  const resetBillOverride = (billId: string) =>
    setBillAmountOverrides((prev) => {
      if (!(billId in prev)) return prev
      const next = { ...prev }
      delete next[billId]
      void persist({ billAmountOverrides: next })
      return next
    })

  const useRecommendedIncome = () => {
    setIncomeAuto(true)
    void persist({ expectedIncomeMinor: null })
  }

  const commitIncomeInput = () => {
    if (incomeAuto) return
    void persist({ expectedIncomeMinor: parseAmountToMinor(incomeInput) })
  }

  const save = async () => {
    await persist({
      expectedIncomeMinor: incomeAuto ? null : parseAmountToMinor(incomeInput),
      plannedItems,
      weeklyStaples,
      includedOverdueBillIds: [...includedOverdueBillIds],
      billAmountOverrides,
    })
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
      {loading && (
        <div className="space-y-4">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={5} />
        </div>
      )}

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
                    onClick={useRecommendedIncome}
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
                onBlur={commitIncomeInput}
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
                {projectedBills.map((bill) => {
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
                      <BillAmountInput
                        key={`${bill.billId}-${bill.amountMinor}`}
                        amountMinor={bill.amountMinor}
                        overridden={bill.billId in billAmountOverrides}
                        disabled={!canEdit}
                        onCommit={(minor) => setBillOverride(bill.billId, minor)}
                        onReset={() => resetBillOverride(bill.billId)}
                      />
                    </li>
                  )
                })}
                {projectedBills.length === 0 &&
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

              {overdueBills.length > 0 && (
                <>
                  <p className="mt-3 text-xs font-medium text-warning">Overdue — include in this plan?</p>
                  <ul className="mt-1 divide-y divide-line">
                    {overdueBills.map((bill) => (
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
                        <BillAmountInput
                          key={`${bill.billId}-${bill.amountMinor}`}
                          amountMinor={bill.amountMinor}
                          overridden={bill.billId in billAmountOverrides}
                          disabled={!canEdit}
                          onCommit={(minor) => setBillOverride(bill.billId, minor)}
                          onReset={() => resetBillOverride(bill.billId)}
                        />
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
              <div>
                <details>
                  <summary className="flex cursor-pointer list-none justify-between">
                    <span className="text-muted">
                      − Weekly staples ({formatMoney(allocation.weeklyStaplesTotalMinor)}/wk × {allocation.weeks})
                    </span>
                    <span className="tabular-nums">
                      {formatMoney(allocation.weeklyStaplesTotalMinor * allocation.weeks)}
                    </span>
                  </summary>
                  {weeklyStaples.length > 0 ? (
                    <ul className="mt-1 space-y-0.5 pl-3 text-xs text-muted">
                      {weeklyStaples.map((s) => (
                        <li key={s.id} className="flex justify-between">
                          <span>{s.name}</span>
                          <span className="tabular-nums">{formatMoney(s.amountMinor)}/wk</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 pl-3 text-xs text-muted">Nothing listed.</p>
                  )}
                </details>
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
              <div className="mt-2 space-y-1.5">
                <p className="text-sm text-danger">
                  Bills, planned items and staples alone come to more than the
                  expected income — something will need to move or wait.
                </p>
                <p className="text-xs text-muted">
                  To cover all of it as planned, expected income would need
                  to be at least{' '}
                  <span className="font-medium text-ink">
                    {formatMoney(requiredIncomeMinor)}
                  </span>{' '}
                  ({formatMoney(-allocation.remainingMinor)} more than what's
                  set now) — or trim a bill, a planned item, or a staple,
                  or see the Tipid tips below for somewhere specific to cut.
                </p>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setIncomeAuto(false)
                      setIncomeInput((requiredIncomeMinor / 100).toFixed(2))
                    }}
                    className="text-xs text-brand underline"
                  >
                    Use {formatMoney(requiredIncomeMinor)} instead
                  </button>
                )}
              </div>
            )}

            {canEdit && (
              <Button variant="primary" onClick={() => void save()} className="mt-3">
                Save plan
              </Button>
            )}
            {saved && <p className="mt-2 text-xs text-success">Saved.</p>}
          </Card>

          <Card>
            <h2 className="section-title">Tipid tips</h2>
            <p className="mt-1 text-xs text-muted">
              Not everything you spend on is a weekly need — these are
              bought only occasionally, from how often you've actually
              bought them, not a guess. Cutting one back is money that can
              go to savings instead, whether or not the plan is tight this
              month.
            </p>
            {recommendation.savingsTips.length === 0 ? (
              <p className="mt-2 text-sm text-muted">
                Nothing occasional enough to flag yet — everything recorded
                looks like a real weekly need.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm">
                  Cutting all of these could free up about{' '}
                  <span className="font-medium text-brand">
                    {formatMoney(
                      recommendation.savingsTips.reduce(
                        (sum, t) => sum + t.potentialMonthlyMinor,
                        0,
                      ),
                    )}
                  </span>{' '}
                  this month.
                </p>
                <ul className="mt-2 divide-y divide-line">
                  {recommendation.savingsTips.map((tip) => (
                    <li key={tip.categoryName} className="flex items-center justify-between py-1.5 text-sm">
                      <span>
                        {tip.categoryName}
                        <span className="ml-2 text-xs text-muted">
                          bought {tip.weeksWithPurchase} of the last {tip.weekCount} weeks
                        </span>
                      </span>
                      <span className="tabular-nums text-muted">
                        ~{formatMoney(tip.potentialMonthlyMinor)}/mo if skipped
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

export default Budget
