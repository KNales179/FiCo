import type { BillRecurrence } from '../types/models'

/**
 * Next due date after `iso`, keeping day-of-month (clamped) for MONTHLY/
 * YEARLY. For SCHEDULED, ignores intervals entirely and looks for the
 * earliest date in `scheduledDates` that's still ahead of `iso` — null
 * once none are left (nothing more scheduled until someone adds one). For
 * NONE, always null — there's no date to advance to.
 */
export const advanceDueDate = (
  iso: string,
  recurrence: BillRecurrence,
  scheduledDates?: string[] | null,
): string | null => {
  if (recurrence === 'NONE') return null

  if (recurrence === 'SCHEDULED') {
    const upcoming = (scheduledDates ?? [])
      .filter((d) => d > iso)
      .sort()
    return upcoming[0] ?? null
  }

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
 *
 * Not meaningful for SCHEDULED or NONE — the caller handles those directly
 * (SCHEDULED restores the exact consumed date from the payment's own
 * periodKey; NONE never had a due date to roll back in the first place).
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
  bills: Array<{
    id: string
    name: string
    active: boolean
    nextDueDate: string | null
  }>,
  nowIso: string,
  daysAhead: number = DUE_SOON_DAYS,
): BillReminder[] => {
  const thresholdIso = new Date(
    new Date(nowIso).getTime() + daysAhead * 24 * 60 * 60 * 1000,
  ).toISOString()

  return bills
    // A NONE bill (no due date at all) or a SCHEDULED bill with nothing
    // left on its calendar has nothing to be "due soon" about.
    .filter(
      (bill): bill is typeof bill & { nextDueDate: string } =>
        bill.active && bill.nextDueDate != null && bill.nextDueDate <= thresholdIso,
    )
    .map((bill) => ({
      billId: bill.id,
      name: bill.name,
      dueDate: bill.nextDueDate,
      overdue: bill.nextDueDate < nowIso,
    }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

/**
 * How many days before its due date a bill becomes payable. Paying far
 * ahead of schedule is what made an already-paid bill look unpaid until
 * someone checked the date and the payment history (owner feedback) — so
 * outside this window, paying is refused rather than silently allowed.
 * A bill that's already overdue is always payable, no matter how late.
 */
export const PAYABLE_WINDOW_DAYS = 7

/** True once `dueDateIso` is within `windowDays` of `paidAtIso`, or past. */
export const isBillPayable = (
  dueDateIso: string,
  paidAtIso: string,
  windowDays: number = PAYABLE_WINDOW_DAYS,
): boolean => {
  const windowStart = new Date(dueDateIso).getTime() - windowDays * 24 * 60 * 60 * 1000
  return new Date(paidAtIso).getTime() >= windowStart
}

/** The earliest a bill becomes payable — for "payable starting …" messaging. */
export const billPayableFrom = (
  dueDateIso: string,
  windowDays: number = PAYABLE_WINDOW_DAYS,
): string =>
  new Date(
    new Date(dueDateIso).getTime() - windowDays * 24 * 60 * 60 * 1000,
  ).toISOString()

/**
 * Stable key for the occurrence a date belongs to — dedupes payments so the
 * same period can't be paid twice. For SCHEDULED, each exact date *is* its
 * own occurrence (there's no month/year bucket to share), so the key is
 * just the date itself. NONE has no periods at all — its own payments never
 * go through this (see `payBill`), since there's nothing to dedupe against.
 */
export const periodKey = (
  iso: string,
  recurrence: BillRecurrence,
): string => {
  if (recurrence === 'SCHEDULED') return iso.slice(0, 10)

  const date = new Date(iso)
  const year = date.getUTCFullYear()
  if (recurrence === 'YEARLY') return String(year)
  return `${year}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}
