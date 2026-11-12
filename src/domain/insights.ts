import type { Transaction } from '../types/models'

/**
 * Small, pure aggregations behind the dashboard / Bills / Budget charts.
 * All of them count only the Finance's own currency (never silently adding
 * a foreign-currency account into a peso total) and never count transfers
 * as spending or income.
 */

const dayKey = (iso: string) => iso.slice(0, 10)
const monthKey = (iso: string) => iso.slice(0, 7)

const shortDay = (key: string) =>
  new Date(`${key}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
const shortMonth = (key: string) =>
  new Date(`${key}-01T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' })
const longMonth = (key: string) =>
  new Date(`${key}-01T00:00:00Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })

/** Expense per day for the last `days` days (today included), oldest first. */
export const dailySpending = (transactions: Transaction[], days: number, currency: string) => {
  const today = new Date()
  const keys: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() - i))
    keys.push(d.toISOString().slice(0, 10))
  }
  const totals = new Map(keys.map((k) => [k, 0]))
  for (const t of transactions) {
    if (t.type !== 'EXPENSE' || t.currency !== currency) continue
    const k = dayKey(t.occurredAt)
    if (totals.has(k)) totals.set(k, totals.get(k)! + t.amountMinor)
  }
  return keys.map((k) => ({
    key: k,
    label: new Date(`${k}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', timeZone: 'UTC' }),
    title: shortDay(k),
    value: totals.get(k)!,
  }))
}

/** Money in vs out per calendar month for the last `months` months, oldest first. */
export const monthlyInOut = (transactions: Transaction[], months: number, currency: string) => {
  const now = new Date()
  const keys: string[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1))
    keys.push(d.toISOString().slice(0, 7))
  }
  const rows = new Map(keys.map((k) => [k, { income: 0, expense: 0 }]))
  for (const t of transactions) {
    if (t.currency !== currency || t.sourceType === 'OPENING_BALANCE') continue
    const row = rows.get(monthKey(t.occurredAt))
    if (!row) continue
    if (t.type === 'INCOME') row.income += t.amountMinor
    else if (t.type === 'EXPENSE') row.expense += t.amountMinor
  }
  return keys.map((k) => ({
    key: k,
    label: shortMonth(k),
    title: longMonth(k),
    values: [rows.get(k)!.income, rows.get(k)!.expense],
  }))
}

/** Expense by category since `fromIso`, largest first. */
export const spendingByCategory = (transactions: Transaction[], fromIso: string, currency: string) => {
  const totals = new Map<string, number>()
  for (const t of transactions) {
    if (t.type !== 'EXPENSE' || t.currency !== currency || t.occurredAt < fromIso) continue
    const name = t.categoryName || 'Uncategorized'
    totals.set(name, (totals.get(name) ?? 0) + t.amountMinor)
  }
  return [...totals.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
}

export const startOfMonthIso = (d = new Date()) =>
  new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1)).toISOString()

export { shortMonth, longMonth }
