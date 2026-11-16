import type { Bill, Transaction } from '../../types/models'
import { paydayInMonth } from '../profile'

/**
 * The money calendar: for each day of a month, what happened (records,
 * bills paid) and what's coming (bills due, paydays) — the same picture as
 * the front page's "no end-of-month surprises" calendar, from real data.
 */

/** "2026-11-16" for a date, in the person's own time zone. */
export const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** A stored date (plain "YYYY-MM-DD" or a full timestamp) as its local day. */
export const keyOf = (value: string | null | undefined): string | null => {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : dayKey(d)
}

export interface CalendarDay {
  key: string
  day: number
  payday: boolean
  /** Records that day (not counting bill payments, which are listed under billsPaid). */
  records: Transaction[]
  billsPaid: Transaction[]
  billsDue: Bill[]
  receivedMinor: number
  spentMinor: number
}

export interface CalendarMonth {
  year: number
  /** 1–12 */
  month: number
  days: CalendarDay[]
  /** Blank cells before day 1, for a week that starts on Sunday. */
  leading: number
  receivedMinor: number
  spentMinor: number
}

export const buildMonth = (
  year: number,
  month: number,
  data: { transactions: Transaction[]; bills: Bill[]; paydays: number[]; currency?: string },
): CalendarMonth => {
  const count = new Date(year, month, 0).getDate()
  const days: CalendarDay[] = Array.from({ length: count }, (_, i) => ({
    key: dayKey(new Date(year, month - 1, i + 1)),
    day: i + 1,
    payday: false,
    records: [],
    billsPaid: [],
    billsDue: [],
    receivedMinor: 0,
    spentMinor: 0,
  }))
  const byKey = new Map(days.map((d) => [d.key, d]))

  for (const p of data.paydays) {
    const key = dayKey(paydayInMonth(p, year, month))
    const day = byKey.get(key)
    if (day) day.payday = true
  }

  let receivedMinor = 0
  let spentMinor = 0
  for (const t of data.transactions) {
    if (t.deletedAt) continue
    const day = byKey.get(keyOf(t.occurredAt) ?? '')
    if (!day) continue
    if (t.sourceType === 'BILL_PAYMENT') day.billsPaid.push(t)
    else day.records.push(t)
    // Totals in the Finance's own currency (a transfer moves money, it isn't spent).
    if (data.currency && t.currency && t.currency !== data.currency) continue
    if (t.type === 'INCOME' && t.sourceType !== 'OPENING_BALANCE') {
      day.receivedMinor += t.amountMinor
      receivedMinor += t.amountMinor
    } else if (t.type === 'EXPENSE') {
      day.spentMinor += t.amountMinor
      spentMinor += t.amountMinor
    }
  }

  for (const b of data.bills) {
    if (!b.active || b.deletedAt) continue
    const dates = new Set([keyOf(b.nextDueDate), ...(b.scheduledDates ?? []).map(keyOf)])
    for (const key of dates) {
      const day = key ? byKey.get(key) : undefined
      if (day && !day.billsDue.some((x) => x.id === b.id)) day.billsDue.push(b)
    }
  }

  return {
    year,
    month,
    days,
    leading: new Date(year, month - 1, 1).getDay(),
    receivedMinor,
    spentMinor,
  }
}
