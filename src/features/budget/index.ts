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
  averageMinor,
  detectTrend,
  periodRangeIso,
  priorPeriods,
  projectBillsForPeriod,
  type ProjectedBill,
  type Trend,
} from '../../domain/budget'

export const getBudgetPlan = (
  spaceId: string,
  period: string,
): Promise<BudgetPlan | undefined> =>
  budgetPlanRepository.getByPeriod(spaceId, period)

export const listBudgetPlans = (spaceId: string): Promise<BudgetPlan[]> =>
  budgetPlanRepository.listBySpace(spaceId)

export interface BudgetRecommendation {
  /** Average of the last few months' actual income — a starting point, not a guess forced on the person. */
  incomeMinor: number
  projectedBills: ProjectedBill[]
  /** Per bill id, how its recent payments have been trending. */
  billTrends: Record<string, Trend | null>
  /** Average of the last few months' non-bill expenses — the baseline the weekly figure is really covering. */
  averageVariableSpendingMinor: number
}

const LOOKBACK_MONTHS = 3
const TREND_SAMPLE = 4

/**
 * Everything "smart" about the budget planner: plain averages and trend
 * checks over this space's own history, computed on this device (§ budget
 * planning — no cloud AI, same rule as receipt scanning).
 */
export const recommendBudget = async (
  spaceId: string,
  period: string,
): Promise<BudgetRecommendation> => {
  const bills = await billRepository.listBySpace(spaceId)
  const projectedBills = projectBillsForPeriod(bills, period)

  const months = priorPeriods(period, LOOKBACK_MONTHS)
  const monthlyIncome: number[] = []
  const monthlyVariableSpend: number[] = []

  for (const month of months) {
    const [fromIso, toIso] = periodRangeIso(month)
    const rows = await transactionRepository.listBySpaceInRange(
      spaceId,
      fromIso,
      toIso,
    )
    let income = 0
    let variable = 0
    for (const txn of rows) {
      if (txn.deletedAt) continue
      if (txn.type === 'INCOME') income += txn.amountMinor
      else if (txn.type === 'EXPENSE' && txn.sourceType !== 'BILL_PAYMENT') {
        variable += txn.amountMinor
      }
    }
    monthlyIncome.push(income)
    monthlyVariableSpend.push(variable)
  }

  const billTrends: Record<string, Trend | null> = {}
  for (const projected of projectedBills) {
    const payments = await billPaymentRepository.listByBill(projected.billId)
    const amounts = payments
      .filter((p) => !p.deletedAt)
      .sort((a, b) => a.paidAt.localeCompare(b.paidAt))
      .slice(-TREND_SAMPLE)
      .map((p) => p.amountMinor)
    billTrends[projected.billId] = detectTrend(amounts)
  }

  return {
    incomeMinor: averageMinor(monthlyIncome),
    projectedBills,
    billTrends,
    averageVariableSpendingMinor: averageMinor(monthlyVariableSpend),
  }
}

/** Creates or updates the space's plan for `period`. */
export const saveBudgetPlan = async (
  ctx: MutationContext,
  period: string,
  patch: {
    expectedIncomeMinor?: number | null
    plannedItems?: BudgetPlanItem[]
  },
): Promise<BudgetPlan> => {
  const existing = await budgetPlanRepository.getByPeriod(
    ctx.spaceId,
    period,
  )

  if (existing) {
    const next = await budgetPlanRepository.update(existing.id, {
      ...(patch.expectedIncomeMinor !== undefined
        ? { expectedIncomeMinor: patch.expectedIncomeMinor }
        : {}),
      ...(patch.plannedItems !== undefined
        ? { plannedItems: patch.plannedItems }
        : {}),
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
    createdBy: ctx.userId,
    syncStatus: 'PENDING',
    version: 1,
  })
  await enqueueMutation(ctx, 'budgetPlan', created.id, 'CREATE', created)
  return created
}
