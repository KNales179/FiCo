import { describe, expect, it } from 'vitest'
import {
  formatMoney,
  minorToDecimalString,
  parseAmountToMinor,
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
