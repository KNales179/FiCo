/**
 * Money in Fico is always an integer number of **minor units** (centavos for
 * PHP) plus an ISO currency code. Never a float (Architecture Rule 14, §31).
 * This module is the only place that converts between minor units and the
 * strings a person types or reads.
 */

export interface Money {
  amountMinor: number
  currency: string
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  PHP: '₱',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
}

/** Minor units per major unit. JPY has none; most currencies have 100. */
const MINOR_PER_MAJOR: Record<string, number> = {
  JPY: 1,
}

export const minorPerMajor = (currency: string): number =>
  MINOR_PER_MAJOR[currency.toUpperCase()] ?? 100

export const currencySymbol = (currency: string): string =>
  CURRENCY_SYMBOLS[currency.toUpperCase()] ?? `${currency.toUpperCase()} `

export const isValidMinor = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value)

/**
 * Parse a user-typed amount ("1,250.50", "1250") into minor units.
 * Returns null if it isn't a sane positive-or-zero amount.
 */
export const parseAmountToMinor = (
  input: string,
  currency = 'PHP',
): number | null => {
  const cleaned = input.replace(/[,\s]/g, '').trim()
  if (cleaned === '' || !/^\d*\.?\d*$/.test(cleaned)) return null

  const factor = minorPerMajor(currency)
  const [whole, fraction = ''] = cleaned.split('.')

  // A zero-minor currency (e.g. JPY) has no fractional part at all.
  if (factor === 1) {
    return fraction === '' && /^\d+$/.test(whole || '0')
      ? Number(whole || '0')
      : null
  }

  const fractionDigits = String(factor - 1).length
  if (fraction.length > fractionDigits) return null

  const paddedFraction = fraction.padEnd(fractionDigits, '0')
  const minor =
    Number(whole || '0') * factor + Number(paddedFraction || '0')

  return Number.isFinite(minor) ? minor : null
}

/**
 * Moves an existing ISO timestamp to a new calendar date (`"YYYY-MM-DD"`,
 * as a `<input type="date">` gives it) without touching its time-of-day.
 * Used when editing a transaction's date: a bill payment (or anything
 * else recorded with a real time, not just a date) would otherwise get
 * silently flattened to midnight on every edit — moving it earlier in the
 * day and reordering it among that day's other transactions even though
 * nothing about when it actually happened changed.
 */
export const withUpdatedDate = (originalIso: string, newDate: string): string => {
  const [year, month, day] = newDate.split('-').map(Number)
  const next = new Date(originalIso)
  next.setUTCFullYear(year, month - 1, day)
  return next.toISOString()
}

/** Minor units → a plain decimal string ("1250.50"), no symbol or grouping. */
export const minorToDecimalString = (
  amountMinor: number,
  currency = 'PHP',
): string => {
  const factor = minorPerMajor(currency)
  if (factor === 1) return String(amountMinor)

  const sign = amountMinor < 0 ? '-' : ''
  const abs = Math.abs(amountMinor)
  const whole = Math.floor(abs / factor)
  const fraction = String(abs % factor).padStart(
    String(factor - 1).length,
    '0',
  )
  return `${sign}${whole}.${fraction}`
}

/** Minor units → a display string with grouping and symbol ("₱1,250.50"). */
export const formatMoney = (
  amountMinor: number,
  currency = 'PHP',
): string => {
  const factor = minorPerMajor(currency)
  const value = amountMinor / factor
  const fractionDigits = factor === 1 ? 0 : String(factor - 1).length

  const formatted = new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Math.abs(value))

  const sign = amountMinor < 0 ? '-' : ''
  return `${sign}${currencySymbol(currency)}${formatted}`
}
