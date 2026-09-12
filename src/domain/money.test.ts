import { describe, expect, it } from 'vitest'
import {
  formatMoney,
  minorToDecimalString,
  parseAmountToMinor,
  withUpdatedDate,
} from './money'

describe('parseAmountToMinor', () => {
  it('parses plain and grouped amounts', () => {
    expect(parseAmountToMinor('1250')).toBe(125000)
    expect(parseAmountToMinor('1,250.50')).toBe(125050)
    expect(parseAmountToMinor('0.05')).toBe(5)
    expect(parseAmountToMinor('  10 ')).toBe(1000)
  })

  it('rejects over-precise or junk input', () => {
    expect(parseAmountToMinor('10.999')).toBeNull()
    expect(parseAmountToMinor('abc')).toBeNull()
    expect(parseAmountToMinor('1.2.3')).toBeNull()
    expect(parseAmountToMinor('')).toBeNull()
  })

  it('handles a zero-minor currency', () => {
    expect(parseAmountToMinor('500', 'JPY')).toBe(500)
    expect(parseAmountToMinor('5.5', 'JPY')).toBeNull()
  })
})

describe('formatMoney', () => {
  it('formats with symbol, grouping and sign', () => {
    expect(formatMoney(125050, 'PHP')).toBe('₱1,250.50')
    expect(formatMoney(-5000, 'PHP')).toBe('-₱50.00')
    expect(formatMoney(0, 'PHP')).toBe('₱0.00')
  })
})

describe('minorToDecimalString', () => {
  it('round-trips with parseAmountToMinor', () => {
    for (const n of [0, 5, 125050, 99, 1000000]) {
      expect(parseAmountToMinor(minorToDecimalString(n))).toBe(n)
    }
  })
})

describe('withUpdatedDate', () => {
  it('moves the calendar date but keeps the original time-of-day', () => {
    // A bill payment recorded at a real moment, not midnight — editing
    // the transaction (without deliberately changing the date) must not
    // flatten this to midnight and silently reorder it among that day's
    // other transactions (owner feedback: "it got rearranged... there
    // was already a spending before [this] was recorded").
    expect(
      withUpdatedDate('2026-09-12T14:23:05.000Z', '2026-09-12'),
    ).toBe('2026-09-12T14:23:05.000Z')
  })

  it('changing the date only shifts the day, not the time', () => {
    expect(
      withUpdatedDate('2026-09-12T14:23:05.000Z', '2026-09-20'),
    ).toBe('2026-09-20T14:23:05.000Z')
  })
})
