import { describe, expect, it } from 'vitest'
import {
  combineDateAndTime,
  formatMoney,
  minorToDecimalString,
  parseAmountToMinor,
  timeOfDay,
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

describe('timeOfDay + combineDateAndTime', () => {
  it("timeOfDay reads a timestamp's own time-of-day for the edit form to default to", () => {
    expect(timeOfDay('2026-09-12T14:23:05.000Z')).toBe('14:23')
    expect(timeOfDay('2026-09-12T00:00:00.000Z')).toBe('00:00')
  })

  it('combineDateAndTime round-trips with timeOfDay — an edit that only changes the date keeps the original time', () => {
    // A bill payment recorded at a real moment, not midnight — editing
    // the transaction (without deliberately changing the time) must not
    // flatten this to midnight and silently reorder it among that day's
    // other transactions (owner feedback: "it got rearranged... there
    // was already a spending before [this] was recorded").
    const original = '2026-09-12T14:23:05.000Z'
    expect(combineDateAndTime('2026-09-12', timeOfDay(original))).toBe(
      '2026-09-12T14:23:00.000Z', // seconds aren't representable by <input type="time">
    )
    expect(combineDateAndTime('2026-09-20', timeOfDay(original))).toBe(
      '2026-09-20T14:23:00.000Z',
    )
  })

  it('an already-flattened record can be nudged to a real time by hand', () => {
    expect(combineDateAndTime('2026-09-12', '16:45')).toBe(
      '2026-09-12T16:45:00.000Z',
    )
  })

  it('a blank time defaults to midnight, same as before this existed', () => {
    expect(combineDateAndTime('2026-09-12', '')).toBe(
      '2026-09-12T00:00:00.000Z',
    )
  })
})
