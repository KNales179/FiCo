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
