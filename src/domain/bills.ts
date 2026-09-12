import type { BillRecurrence } from '../types/models'

/** Next due date after `iso`, keeping day-of-month (clamped). Mirrors the server. */
export const advanceDueDate = (
  iso: string,
  recurrence: BillRecurrence,
): string => {
  const next = new Date(iso)

  if (recurrence === 'YEARLY') {
    next.setUTCFullYear(next.getUTCFullYear() + 1)
    return next.toISOString()
  }

  const day = next.getUTCDate()
  next.setUTCDate(1)
  next.setUTCMonth(next.getUTCMonth() + 1)
  const lastDay = new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0),
  ).getUTCDate()
  next.setUTCDate(Math.min(day, lastDay))
  return next.toISOString()
}

/**
 * Undoes `advanceDueDate` — one recurrence step earlier, keeping
 * day-of-month (clamped) the same way. Used to roll a bill's due date back
 * when its most recent payment is deleted (a mis-paid bill, a wrong amount,
 * a due date that was set wrong to begin with). Like `advanceDueDate`, a
 * day past the shorter month it lands on gets clamped — so undoing a step
 * that itself clamped (e.g. Jan 31 → Feb 28) won't recover the original
 * day exactly. That's an acceptable, rare edge case for an undo action.
 */
export const retreatDueDate = (
  iso: string,
  recurrence: BillRecurrence,
): string => {
  const prev = new Date(iso)

  if (recurrence === 'YEARLY') {
    prev.setUTCFullYear(prev.getUTCFullYear() - 1)
    return prev.toISOString()
  }

  const day = prev.getUTCDate()
  prev.setUTCDate(1)
  prev.setUTCMonth(prev.getUTCMonth() - 1)
  const lastDay = new Date(
    Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() + 1, 0),
  ).getUTCDate()
  prev.setUTCDate(Math.min(day, lastDay))
  return prev.toISOString()
}

export interface BillReminder {
  billId: string
  name: string
  dueDate: string
  overdue: boolean
}

/** How many days ahead counts as "coming up" for an in-app reminder. */
export const DUE_SOON_DAYS = 3

/**
 * Bills worth flagging right now — already overdue, or due within
 * `daysAhead` — for an in-app "bills due soon" reminder. Sorted soonest
 * (or most overdue) first. A bill that's inactive or further out isn't
 * urgent enough to interrupt anyone with.
 */
export const dueSoonBills = (
  bills: Array<{ id: string; name: string; active: boolean; nextDueDate: string }>,
  nowIso: string,
  daysAhead: number = DUE_SOON_DAYS,
): BillReminder[] => {
  const thresholdIso = new Date(
    new Date(nowIso).getTime() + daysAhead * 24 * 60 * 60 * 1000,
  ).toISOString()

  return bills
    .filter((bill) => bill.active && bill.nextDueDate <= thresholdIso)
    .map((bill) => ({
      billId: bill.id,
      name: bill.name,
      dueDate: bill.nextDueDate,
      overdue: bill.nextDueDate < nowIso,
    }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

/** Stable key for the occurrence a date belongs to — dedupes payments. */
export const periodKey = (
  iso: string,
  recurrence: BillRecurrence,
): string => {
  const date = new Date(iso)
  const year = date.getUTCFullYear()
  if (recurrence === 'YEARLY') return String(year)
  return `${year}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}
