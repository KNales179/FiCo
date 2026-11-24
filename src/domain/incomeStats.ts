import type { Transaction } from '../types/models'

/** One calendar day's income. `date` is YYYY-MM-DD, the same day key the rest of the app uses. */
export interface IncomeDay {
  date: string
  amountMinor: number
  entries: number
}

export interface WeekdayIncome {
  /** 0 = Monday … 6 = Sunday. */
  weekday: number
  totalMinor: number
  /** How many separate days of this weekday had any income. */
  earningDays: number
  /** Average per earning day of this weekday (0 when there were none). */
  avgMinor: number
}

export interface IncomeSource {
  name: string
  amountMinor: number
  pct: number
}

export interface AccountIncome {
  accountId: string
  amountMinor: number
  entries: number
  pct: number
}

export interface IncomeStats {
  totalMinor: number
  entryCount: number
  /** Days with at least one income entry. */
  earningDays: number
  avgPerEarningDayMinor: number
  avgPerEntryMinor: number
  bestDay: IncomeDay | null
  /** Highest-earning days, biggest first (at most 5). */
  topDays: IncomeDay[]
  /** Every day that had income, oldest first. */
  days: IncomeDay[]
  /** Monday first, always 7 rows. */
  byWeekday: WeekdayIncome[]
  /** Income by category ("Sales", "Salary", …), biggest first. */
  bySource: IncomeSource[]
  /** Income by the account it landed in, biggest first — some people keep one account per product. */
  byAccount: AccountIncome[]
}

export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** Monday-first weekday of a YYYY-MM-DD key. */
const weekdayOf = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
}

/**
 * Income-only stats for a set of transactions already filtered to a range —
 * for anyone earning in many small amounts (a booth, a small shop, side jobs)
 * who wants to see which days bring in the most. Only INCOME in `currency`
 * counts; transfers, expenses, private records and accounts' starting
 * balances are ignored.
 */
export const summarizeIncome = (transactions: Transaction[], currency: string): IncomeStats => {
  const perDay = new Map<string, IncomeDay>()
  const perSource = new Map<string, number>()
  const perAccount = new Map<string, { amountMinor: number; entries: number }>()
  let totalMinor = 0
  let entryCount = 0

  for (const t of transactions) {
    if (t.type !== 'INCOME' || t.currency !== currency) continue
    // A new account's starting balance is saved as income, but nobody earned it that day.
    if (t.sourceType === 'OPENING_BALANCE') continue
    // Private records stay out of shared stats, same as the server's totals.
    if (t.visibility === 'PRIVATE') continue
    totalMinor += t.amountMinor
    entryCount += 1
    const date = t.occurredAt.slice(0, 10)
    const day = perDay.get(date) ?? { date, amountMinor: 0, entries: 0 }
    day.amountMinor += t.amountMinor
    day.entries += 1
    perDay.set(date, day)
    const source = t.categoryName?.trim() || 'Uncategorized'
    perSource.set(source, (perSource.get(source) ?? 0) + t.amountMinor)
    const account = perAccount.get(t.accountId) ?? { amountMinor: 0, entries: 0 }
    account.amountMinor += t.amountMinor
    account.entries += 1
    perAccount.set(t.accountId, account)
  }

  const days = [...perDay.values()].sort((a, b) => a.date.localeCompare(b.date))
  // Ties go to the earlier day, so the answer doesn't jump around.
  const topDays = [...days].sort((a, b) => b.amountMinor - a.amountMinor || a.date.localeCompare(b.date)).slice(0, 5)

  const byWeekday: WeekdayIncome[] = WEEKDAY_NAMES.map((_, weekday) => ({
    weekday,
    totalMinor: 0,
    earningDays: 0,
    avgMinor: 0,
  }))
  for (const day of days) {
    const row = byWeekday[weekdayOf(day.date)]
    row.totalMinor += day.amountMinor
    row.earningDays += 1
  }
  for (const row of byWeekday) {
    row.avgMinor = row.earningDays > 0 ? Math.round(row.totalMinor / row.earningDays) : 0
  }

  const bySource = [...perSource.entries()]
    .map(([name, amountMinor]) => ({
      name,
      amountMinor,
      pct: totalMinor > 0 ? (amountMinor / totalMinor) * 100 : 0,
    }))
    .sort((a, b) => b.amountMinor - a.amountMinor)

  return {
    totalMinor,
    entryCount,
    earningDays: days.length,
    avgPerEarningDayMinor: days.length > 0 ? Math.round(totalMinor / days.length) : 0,
    avgPerEntryMinor: entryCount > 0 ? Math.round(totalMinor / entryCount) : 0,
    bestDay: topDays[0] ?? null,
    topDays,
    days,
    byWeekday,
    bySource,
    byAccount: [...perAccount.entries()]
      .map(([accountId, a]) => ({
        accountId,
        ...a,
        pct: totalMinor > 0 ? (a.amountMinor / totalMinor) * 100 : 0,
      }))
      .sort((a, b) => b.amountMinor - a.amountMinor),
  }
}
