import {
  billPaymentRepository,
  billRepository,
  budgetPlanRepository,
  transactionRepository,
} from '../../repositories'
import { enqueueMutation } from '../sync/enqueue'
import type { MutationContext } from '../sync/context'
import type { BudgetPlan, BudgetPlanItem } from '../../types/models'
import {
  detectTrend,
  findOverdueBills,
  medianMinor,
  periodRangeIso,
  priorPeriods,
  projectBillsForPeriod,
  rankWeeklyCategories,
  recommendBillAmount,
  type OverdueBill,
  type PaidAheadBill,
  type ProjectedBill,
  type Trend,
  type WeeklyCategorySpend,
} from '../../domain/budget'

export const getBudgetPlan = (
  spaceId: string,
  period: string,
): Promise<BudgetPlan | undefined> =>
  budgetPlanRepository.getByPeriod(spaceId, period)

export const listBudgetPlans = (spaceId: string): Promise<BudgetPlan[]> =>
  budgetPlanRepository.listBySpace(spaceId)

export interface BudgetRecommendation {
  /** Median of the last few months' actual income — a starting point, not a guess forced on the person. */
  incomeMinor: number
  projectedBills: ProjectedBill[]
  overdueBills: OverdueBill[]
  /** A monthly bill already paid ahead of `period` — nothing left to pay it for this month, and here's why it's not in `projectedBills`. */
  paidAheadBills: PaidAheadBill[]
  /** Per bill id, how its recent payments have been trending. */
  billTrends: Record<string, Trend | null>
  /** Groceries/Food/etc., ranked weekly-habit first, rare-purchase last (medians of ₱0 already excluded). */
  weeklyCategories: WeeklyCategorySpend[]
}

const INCOME_LOOKBACK_MONTHS = 3
const TREND_SAMPLE = 4
const WEEKLY_LOOKBACK_WEEKS = 10

/**
 * Everything "smart" about the budget planner: plain medians/averages and
 * trend checks over this space's own history, computed on this device (§
 * budget planning — no cloud AI, same rule as receipt scanning).
 */
export const recommendBudget = async (
  spaceId: string,
  period: string,
  now = new Date(),
): Promise<BudgetRecommendation> => {
  const bills = await billRepository.listBySpace(spaceId)

  // Each bill's own recent payments recommend its projected amount — a real
  // bill like electricity varies month to month more than a flat "expected
  // amount" typed in once can capture.
  const recommendedAmountByBillId: Record<string, number> = {}
  const billTrends: Record<string, Trend | null> = {}
  for (const bill of bills) {
    if (!bill.active) continue
    const payments = await billPaymentRepository.listByBill(bill.id)
    const amounts = payments
      .filter((p) => !p.deletedAt)
      .sort((a, b) => a.paidAt.localeCompare(b.paidAt))
      .map((p) => p.amountMinor)
    const recommended = recommendBillAmount(amounts)
    if (recommended !== null) recommendedAmountByBillId[bill.id] = recommended
    billTrends[bill.id] = detectTrend(amounts.slice(-TREND_SAMPLE))
  }

  const overdueBills = findOverdueBills(
    bills,
    now.toISOString(),
    recommendedAmountByBillId,
  )
  // A bill already overdue hasn't been paid on schedule, so the regular
  // forward projection — which assumes on-time payment — would otherwise
  // also find a hypothetical occurrence in the target period on top of the
  // real, still-unpaid one. Overdue bills only belong in `overdueBills`
  // until they're actually paid.
  const overdueBillIds = new Set(overdueBills.map((b) => b.billId))
  const { due: projectedBills, paidAhead: paidAheadBills } = projectBillsForPeriod(
    bills.filter((bill) => !overdueBillIds.has(bill.id)),
    period,
    recommendedAmountByBillId,
  )

  // Income: median of the last few months' actual income.
  const months = priorPeriods(period, INCOME_LOOKBACK_MONTHS)
  const monthlyIncome: number[] = []
  const allTransactionsInWindow: Array<{
    occurredAt: string
    amountMinor: number
    categoryName?: string | null
    type: string
    sourceType: string
  }> = []

  for (const month of months) {
    const [fromIso, toIso] = periodRangeIso(month)
    const rows = await transactionRepository.listBySpaceInRange(
      spaceId,
      fromIso,
      toIso,
    )
    let income = 0
    for (const txn of rows) {
      if (txn.deletedAt) continue
      if (txn.type === 'INCOME') income += txn.amountMinor
      allTransactionsInWindow.push(txn)
    }
    monthlyIncome.push(income)
  }

  // Weekly staples: sampled over the weeks leading up to the target period,
  // not calendar months, so the "which weeks actually had a purchase" signal
  // isn't blurred by month boundaries.
  const weekStart = new Date(
    new Date(periodRangeIso(period)[0]).getTime() -
      WEEKLY_LOOKBACK_WEEKS * 7 * 24 * 60 * 60 * 1000,
  ).toISOString()
  const weeklyCategories = rankWeeklyCategories(
    allTransactionsInWindow,
    weekStart,
    WEEKLY_LOOKBACK_WEEKS,
  )

  return {
    incomeMinor: medianMinor(monthlyIncome),
    projectedBills,
    overdueBills,
    paidAheadBills,
    billTrends,
    weeklyCategories,
  }
}

/** Creates or updates the space's plan for `period`. */
export const saveBudgetPlan = async (
  ctx: MutationContext,
  period: string,
  patch: {
    expectedIncomeMinor?: number | null
    plannedItems?: BudgetPlanItem[]
    weeklyStaples?: BudgetPlanItem[]
    includedOverdueBillIds?: string[]
    billAmountOverrides?: Record<string, number>
  },
): Promise<BudgetPlan> => {
  const existing = await budgetPlanRepository.getByPeriod(
    ctx.spaceId,
    period,
  )

  const fields = {
    ...(patch.expectedIncomeMinor !== undefined
      ? { expectedIncomeMinor: patch.expectedIncomeMinor }
      : {}),
    ...(patch.plannedItems !== undefined
      ? { plannedItems: patch.plannedItems }
      : {}),
    ...(patch.weeklyStaples !== undefined
      ? { weeklyStaples: patch.weeklyStaples }
      : {}),
    ...(patch.includedOverdueBillIds !== undefined
      ? { includedOverdueBillIds: patch.includedOverdueBillIds }
      : {}),
    ...(patch.billAmountOverrides !== undefined
      ? { billAmountOverrides: patch.billAmountOverrides }
      : {}),
  }

  if (existing) {
    const next = await budgetPlanRepository.update(existing.id, {
      ...fields,
      syncStatus: 'PENDING',
    })
    await enqueueMutation(ctx, 'budgetPlan', next.id, 'UPDATE', next)
    return next
  }

  const created = await budgetPlanRepository.create({
    spaceId: ctx.spaceId,
    period,
    expectedIncomeMinor: patch.expectedIncomeMinor ?? null,
    plannedItems: patch.plannedItems ?? [],
    weeklyStaples: patch.weeklyStaples ?? [],
    includedOverdueBillIds: patch.includedOverdueBillIds ?? [],
    billAmountOverrides: patch.billAmountOverrides ?? {},
    createdBy: ctx.userId,
    syncStatus: 'PENDING',
    version: 1,
  })
  await enqueueMutation(ctx, 'budgetPlan', created.id, 'CREATE', created)
  return created
}
