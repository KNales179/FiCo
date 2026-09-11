/**
 * Next-month budget planning (Roadmap Phase 26 feedback). "Smart" here means
 * plain arithmetic over the space's own history, computed entirely on this
 * device — no cloud AI, per the same rule the receipt scanner follows.
 */

import type { Bill } from '../types/models'
import { advanceDueDate } from './bills'

export interface ProjectedBill {
  billId: string
  name: string
  amountMinor: number
  dueDate: string
}

/**
 * Which of a space's active bills fall due within `period` (`"YYYY-MM"`),
 * projected forward from each bill's own next occurrence — a monthly bill
 * lands most months, a yearly one only in its month. A bill with no
 * expected amount yet contributes 0 rather than a guess; the caller decides
 * whether to flag that.
 */
export const projectBillsForPeriod = (
  bills: Array<
    Pick<
      Bill,
      'id' | 'name' | 'active' | 'nextDueDate' | 'recurrence' | 'expectedAmountMinor'
    >
  >,
  period: string,
): ProjectedBill[] => {
  const results: ProjectedBill[] = []

  for (const bill of bills) {
    if (!bill.active) continue

    let due = bill.nextDueDate
    // Walk forward at most two years — plenty for any recurrence this app
    // supports, and a hard stop so bad data can't loop forever.
    for (let i = 0; i < 24; i += 1) {
      const duePeriod = due.slice(0, 7)
      if (duePeriod === period) {
        results.push({
          billId: bill.id,
          name: bill.name,
          amountMinor: bill.expectedAmountMinor ?? 0,
          dueDate: due,
        })
        break
      }
      // Walked past the target month without landing in it (a yearly bill
      // due a different month) — nothing to project for this period.
      if (duePeriod > period) break
      due = advanceDueDate(due, bill.recurrence)
    }
  }

  return results
}

export const averageMinor = (values: number[]): number =>
  values.length === 0
    ? 0
    : Math.round(values.reduce((sum, v) => sum + v, 0) / values.length)

export type Trend = 'up' | 'down' | 'flat'

/**
 * Compares the most recent value against the average of the ones before it.
 * Needs at least two data points and a non-zero baseline — otherwise there's
 * nothing to compare, so it says so rather than guessing a direction.
 */
export const detectTrend = (
  values: number[],
  thresholdPct = 10,
): Trend | null => {
  if (values.length < 2) return null
  const latest = values[values.length - 1]
  const priorAvg = averageMinor(values.slice(0, -1))
  if (priorAvg === 0) return null

  const changePct = ((latest - priorAvg) / priorAvg) * 100
  if (changePct >= thresholdPct) return 'up'
  if (changePct <= -thresholdPct) return 'down'
  return 'flat'
}

/** How many weekly chunks a calendar month splits into. */
export const weeksInPeriod = (period: string): number => {
  const [year, month] = period.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return Math.ceil(daysInMonth / 7)
}

/** The "YYYY-MM" for the month after `now`. */
export const nextPeriod = (now = new Date()): string => {
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  )
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`
}

/** The `n` periods strictly before `period`, oldest first. */
export const priorPeriods = (period: string, n: number): string[] => {
  const [year, month] = period.split('-').map(Number)
  const out: string[] = []
  for (let i = n; i >= 1; i -= 1) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1))
    out.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
    )
  }
  return out
}

/** ISO `[from, to]` bounds covering the whole of a "YYYY-MM" period. */
export const periodRangeIso = (period: string): [string, string] => {
  const [year, month] = period.split('-').map(Number)
  const from = new Date(Date.UTC(year, month - 1, 1))
  const to = new Date(Date.UTC(year, month, 1) - 1)
  return [from.toISOString(), to.toISOString()]
}

export interface PlannedItem {
  name: string
  amountMinor: number
}

export interface BudgetAllocation {
  incomeMinor: number
  billsTotalMinor: number
  plannedTotalMinor: number
  /** Income minus bills minus planned one-off items — what's left for the weeks. */
  remainingMinor: number
  weeklyBudgetMinor: number
  weeks: number
  /** True when the bills + planned items alone exceed the expected income. */
  overBudget: boolean
}

/**
 * Bills come out first (they're the least optional), then the planned
 * one-off items, and whatever's left splits evenly across the month's weeks.
 */
export const allocateBudget = (input: {
  incomeMinor: number
  projectedBills: Array<Pick<ProjectedBill, 'amountMinor'>>
  plannedItems: PlannedItem[]
  period: string
}): BudgetAllocation => {
  const billsTotalMinor = input.projectedBills.reduce(
    (sum, b) => sum + b.amountMinor,
    0,
  )
  const plannedTotalMinor = input.plannedItems.reduce(
    (sum, p) => sum + p.amountMinor,
    0,
  )
  const remainingMinor = input.incomeMinor - billsTotalMinor - plannedTotalMinor
  const weeks = weeksInPeriod(input.period)

  return {
    incomeMinor: input.incomeMinor,
    billsTotalMinor,
    plannedTotalMinor,
    remainingMinor,
    weeklyBudgetMinor: weeks > 0 ? Math.floor(remainingMinor / weeks) : remainingMinor,
    weeks,
    overBudget: remainingMinor < 0,
  }
}
