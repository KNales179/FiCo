import type { Transaction } from '../types/models'

export type AnalyticsPeriod =
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'THIS_YEAR'
  | 'LAST_YEAR'
  | 'ALL_TIME'
  | 'CUSTOM'

export interface DateRange {
  fromIso: string
  toIso: string
}

const startOfDay = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))

/** Turn a period choice into a concrete [from, to] range (to is exclusive-ish, end of day). */
export const resolveRange = (
  period: AnalyticsPeriod,
  custom?: Partial<DateRange>,
  now = new Date(),
): DateRange => {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()

  switch (period) {
    case 'THIS_MONTH':
      return {
        fromIso: new Date(Date.UTC(y, m, 1)).toISOString(),
        toIso: new Date(Date.UTC(y, m + 1, 1) - 1).toISOString(),
      }
    case 'LAST_MONTH':
      return {
        fromIso: new Date(Date.UTC(y, m - 1, 1)).toISOString(),
        toIso: new Date(Date.UTC(y, m, 1) - 1).toISOString(),
      }
    case 'THIS_YEAR':
      return {
        fromIso: new Date(Date.UTC(y, 0, 1)).toISOString(),
        toIso: new Date(Date.UTC(y + 1, 0, 1) - 1).toISOString(),
      }
    case 'LAST_YEAR':
      return {
        fromIso: new Date(Date.UTC(y - 1, 0, 1)).toISOString(),
        toIso: new Date(Date.UTC(y, 0, 1) - 1).toISOString(),
      }
    case 'CUSTOM':
      return {
        fromIso:
          custom?.fromIso ??
          new Date(Date.UTC(y, m, 1)).toISOString(),
        toIso: custom?.toIso ?? startOfDay(now).toISOString(),
      }
    case 'ALL_TIME':
    default:
      return {
        fromIso: new Date(0).toISOString(),
        toIso: new Date(Date.UTC(y + 100, 0, 1)).toISOString(),
      }
  }
}

export interface CategoryTotal {
  name: string
  amountMinor: number
  pct: number
}

export interface MonthTotal {
  month: string
  incomeMinor: number
  expenseMinor: number
}

export interface AnalyticsSummary {
  currency: string
  incomeMinor: number
  expenseMinor: number
  netMinor: number
  transferMinor: number
  /** Expense as a share of income, 0–100+ (can exceed 100 when overspending). */
  expensePctOfIncome: number
  byCategory: CategoryTotal[]
  byMonth: MonthTotal[]
  billSpendMinor: number
  transactionCount: number
}

const monthKey = (iso: string) => iso.slice(0, 7)

/**
 * Aggregate a set of transactions (already range-filtered). Transfers never
 * count as income or expense (Architecture Rule 4); category comes from the
 * per-transaction `categoryName` snapshot.
 */
export const summarize = (
  transactions: Transaction[],
  currency = 'PHP',
): AnalyticsSummary => {
  let incomeMinor = 0
  let expenseMinor = 0
  let transferMinor = 0
  let billSpendMinor = 0

  const categoryMap = new Map<string, number>()
  const monthMap = new Map<string, MonthTotal>()

  for (const txn of transactions) {
    if (txn.currency !== currency) continue

    const mk = monthKey(txn.occurredAt)
    const month =
      monthMap.get(mk) ??
      { month: mk, incomeMinor: 0, expenseMinor: 0 }

    if (txn.type === 'INCOME') {
      incomeMinor += txn.amountMinor
      month.incomeMinor += txn.amountMinor
    } else if (txn.type === 'EXPENSE') {
      expenseMinor += txn.amountMinor
      month.expenseMinor += txn.amountMinor
      if (txn.sourceType === 'BILL_PAYMENT') {
        billSpendMinor += txn.amountMinor
      }
      const cat = txn.categoryName?.trim() || 'Uncategorized'
      categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + txn.amountMinor)
    } else if (txn.type === 'TRANSFER') {
      transferMinor += txn.amountMinor
    }

    monthMap.set(mk, month)
  }

  const byCategory: CategoryTotal[] = [...categoryMap.entries()]
    .map(([name, amountMinor]) => ({
      name,
      amountMinor,
      pct: expenseMinor > 0 ? (amountMinor / expenseMinor) * 100 : 0,
    }))
    .sort((a, b) => b.amountMinor - a.amountMinor)

  const byMonth = [...monthMap.values()].sort((a, b) =>
    a.month.localeCompare(b.month),
  )

  return {
    currency,
    incomeMinor,
    expenseMinor,
    netMinor: incomeMinor - expenseMinor,
    transferMinor,
    expensePctOfIncome:
      incomeMinor > 0 ? (expenseMinor / incomeMinor) * 100 : 0,
    byCategory,
    byMonth,
    billSpendMinor,
    transactionCount: transactions.filter(
      (t) => t.currency === currency,
    ).length,
  }
}
