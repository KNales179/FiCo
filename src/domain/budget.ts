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
 * A monthly bill whose *next* obligation already falls after `period` —
 * meaning some earlier payment (made ahead of its actual due date) already
 * settled `period`'s occurrence. Without this, such a bill just silently
 * disappears from the plan for that one month with no explanation, which
 * reads as a bug even though it's correct: there's genuinely nothing left
 * to pay this bill for that month. Surfacing it instead says so plainly.
 */
export interface PaidAheadBill {
  billId: string
  name: string
  /** When the next actual occurrence is due. */
  nextDueDate: string
}

export interface BillProjection {
  due: ProjectedBill[]
  paidAhead: PaidAheadBill[]
}

/**
 * Which of a space's active bills fall due within `period` (`"YYYY-MM"`),
 * projected forward from each bill's own next occurrence — a monthly bill
 * lands most months, a yearly one only in its month. `amountMinor` prefers a
 * recent-payments-based recommendation (`recommendBillAmount`) passed in by
 * the caller over the bill's static "expected amount", since a bill like
 * electricity actually varies month to month.
 */
export const projectBillsForPeriod = (
  bills: Array<
    Pick<
      Bill,
      'id' | 'name' | 'active' | 'nextDueDate' | 'recurrence' | 'expectedAmountMinor'
    >
  >,
  period: string,
  recommendedAmountByBillId: Record<string, number> = {},
): BillProjection => {
  const due: ProjectedBill[] = []
  const paidAhead: PaidAheadBill[] = []

  for (const bill of bills) {
    if (!bill.active) continue

    let cursor = bill.nextDueDate
    // Walk forward at most two years — plenty for any recurrence this app
    // supports, and a hard stop so bad data can't loop forever.
    for (let i = 0; i < 24; i += 1) {
      const duePeriod = cursor.slice(0, 7)
      if (duePeriod === period) {
        due.push({
          billId: bill.id,
          name: bill.name,
          amountMinor:
            recommendedAmountByBillId[bill.id] ?? bill.expectedAmountMinor ?? 0,
          dueDate: cursor,
        })
        break
      }
      if (duePeriod > period) {
        // Walked past the target month without landing in it. For a
        // monthly bill, its very next obligation (the first step of this
        // walk) already being beyond `period` means it was paid ahead of
        // schedule and `period`'s occurrence is already settled — worth
        // saying so. A yearly bill simply isn't due this particular month,
        // which is normal and not worth flagging every time.
        if (i === 0 && bill.recurrence === 'MONTHLY') {
          paidAhead.push({
            billId: bill.id,
            name: bill.name,
            nextDueDate: cursor,
          })
        }
        break
      }
      cursor = advanceDueDate(cursor, bill.recurrence)
    }
  }

  return { due, paidAhead }
}

export interface OverdueBill {
  billId: string
  name: string
  dueDate: string
  amountMinor: number
}

/** Active bills whose due date has already passed without being paid. */
export const findOverdueBills = (
  bills: Array<
    Pick<Bill, 'id' | 'name' | 'active' | 'nextDueDate' | 'expectedAmountMinor'>
  >,
  todayIso: string,
  recommendedAmountByBillId: Record<string, number> = {},
): OverdueBill[] =>
  bills
    .filter((bill) => bill.active && bill.nextDueDate < todayIso)
    .map((bill) => ({
      billId: bill.id,
      name: bill.name,
      dueDate: bill.nextDueDate,
      amountMinor:
        recommendedAmountByBillId[bill.id] ?? bill.expectedAmountMinor ?? 0,
    }))

export const averageMinor = (values: number[]): number =>
  values.length === 0
    ? 0
    : Math.round(values.reduce((sum, v) => sum + v, 0) / values.length)

/** The middle value — unlike an average, one unusually large or small entry can't drag it around. */
export const medianMinor = (values: number[]): number => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid]
}

/**
 * A bill's recommended amount from its own recent payments (most recent
 * last) — an average of up to the last 3, so a real month-to-month bill like
 * electricity is projected from what it's actually been costing lately.
 * Falls back to nothing (caller decides, usually the bill's own "expected
 * amount") when there's no payment history yet.
 */
export const recommendBillAmount = (
  recentPaymentAmounts: number[],
): number | null =>
  recentPaymentAmounts.length === 0
    ? null
    : averageMinor(recentPaymentAmounts.slice(-3))

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

export interface WeeklyCategorySpend {
  categoryName: string
  /** Median of this category's per-week totals over the sampled weeks. */
  weeklyMedianMinor: number
}

/**
 * Ranks categories by how much of a weekly habit they actually are, from a
 * space's own transaction history — "important/frequent" down to "rarely
 * bought", per the owner's ask, without a separate frequency calculation.
 *
 * Buckets each non-bill expense into which 7-day window (from `weekStartIso`)
 * it fell in, sums per category per week, then takes the *median* across
 * `weekCount` weeks. A category bought almost every week gets a median close
 * to a typical week's spend; one bought only occasionally has more zero
 * weeks than not, so its median comes out at or near 0 — which is exactly
 * "not a routine weekly cost", with no separate rule needed. Categories
 * whose median is 0 are dropped: nothing to recommend weekly for them.
 */
export const rankWeeklyCategories = (
  transactions: Array<{
    occurredAt: string
    amountMinor: number
    categoryName?: string | null
    type: string
    sourceType: string
  }>,
  weekStartIso: string,
  weekCount: number,
): WeeklyCategorySpend[] => {
  const weekStartMs = new Date(weekStartIso).getTime()
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000
  const byCategory = new Map<string, number[]>()

  for (const txn of transactions) {
    if (txn.type !== 'EXPENSE' || txn.sourceType === 'BILL_PAYMENT') continue

    const weekIndex = Math.floor(
      (new Date(txn.occurredAt).getTime() - weekStartMs) / WEEK_MS,
    )
    if (weekIndex < 0 || weekIndex >= weekCount) continue

    const name = txn.categoryName?.trim() || 'Uncategorized'
    const weeks = byCategory.get(name) ?? new Array(weekCount).fill(0)
    weeks[weekIndex] += txn.amountMinor
    byCategory.set(name, weeks)
  }

  return [...byCategory.entries()]
    .map(([categoryName, weeks]) => ({
      categoryName,
      weeklyMedianMinor: medianMinor(weeks),
    }))
    .filter((c) => c.weeklyMedianMinor > 0)
    .sort((a, b) => b.weeklyMedianMinor - a.weeklyMedianMinor)
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
  /** Per-week total of the weekly-staple categories (Groceries, etc.), not a monthly figure. */
  weeklyStaplesTotalMinor: number
  weeks: number
  /** Income minus bills minus planned minus (staples × weeks) — what's left to split as pure discretionary. */
  remainingMinor: number
  /** remainingMinor ÷ weeks — the part of the weekly figure that isn't already spoken for by staples. */
  weeklyDiscretionaryMinor: number
  /** Staples + discretionary — the full "how much can I spend this week" figure. */
  weeklyBudgetMinor: number
  /** True when bills + planned + staples alone exceed the expected income. */
  overBudget: boolean
}

/**
 * Bills come out first (least optional), then one-off planned items, then
 * the weekly staples (converted to a monthly figure via the week count) —
 * whatever's left splits evenly across the month's weeks as discretionary
 * spending money, on top of what the staples already cover.
 */
export const allocateBudget = (input: {
  incomeMinor: number
  projectedBills: Array<Pick<ProjectedBill, 'amountMinor'>>
  plannedItems: PlannedItem[]
  weeklyStaples: PlannedItem[]
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
  const weeklyStaplesTotalMinor = input.weeklyStaples.reduce(
    (sum, s) => sum + s.amountMinor,
    0,
  )
  const weeks = weeksInPeriod(input.period)
  const remainingMinor =
    input.incomeMinor -
    billsTotalMinor -
    plannedTotalMinor -
    weeklyStaplesTotalMinor * weeks
  const weeklyDiscretionaryMinor =
    weeks > 0 ? Math.floor(remainingMinor / weeks) : remainingMinor

  return {
    incomeMinor: input.incomeMinor,
    billsTotalMinor,
    plannedTotalMinor,
    weeklyStaplesTotalMinor,
    weeks,
    remainingMinor,
    weeklyDiscretionaryMinor,
    weeklyBudgetMinor: weeklyStaplesTotalMinor + weeklyDiscretionaryMinor,
    overBudget: remainingMinor < 0,
  }
}
