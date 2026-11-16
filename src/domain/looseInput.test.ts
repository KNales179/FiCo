import { describe, expect, it } from 'vitest'
import { parseLooseDate } from './looseDate'
import { parseAmountToMinor } from './money'

const today = new Date(2026, 10, 17) // Tue 17 Nov 2026

describe("Postel's law: amounts", () => {
  it('accepts amounts however they are typed', () => {
    expect(parseAmountToMinor('1,250.50')).toBe(125050)
    expect(parseAmountToMinor('₱1,250')).toBe(125000)
    expect(parseAmountToMinor('PHP 1 250')).toBe(125000)
    expect(parseAmountToMinor('+150')).toBe(15000)
    expect(parseAmountToMinor('1.5k')).toBe(150000)
    expect(parseAmountToMinor('2K')).toBe(200000)
    expect(parseAmountToMinor('12,50')).toBe(1250)
    expect(parseAmountToMinor('1.234,50')).toBe(123450)
    expect(parseAmountToMinor('P250')).toBe(25000)
  })
  it('still refuses what is not an amount', () => {
    expect(parseAmountToMinor('abc')).toBeNull()
    expect(parseAmountToMinor('-5')).toBeNull()
    expect(parseAmountToMinor('')).toBeNull()
  })
})

describe("Postel's law: dates", () => {
  const p = (s: string, prefer: 'past' | 'future' = 'past') => parseLooseDate(s, { today, prefer })
  it('understands words', () => {
    expect(p('today')).toBe('2026-11-17')
    expect(p('Yesterday')).toBe('2026-11-16')
    expect(p('tomorrow')).toBe('2026-11-18')
    expect(p('3 days ago')).toBe('2026-11-14')
    expect(p('-2')).toBe('2026-11-15')
    expect(p('last friday')).toBe('2026-11-13')
    expect(p('fri', 'future')).toBe('2026-11-20')
  })
  it('understands written dates', () => {
    expect(p('Nov 16')).toBe('2026-11-16')
    expect(p('16 November 2025')).toBe('2025-11-16')
    expect(p('2026-11-03')).toBe('2026-11-03')
    expect(p('the 3rd')).toBe('2026-11-03')
    expect(p('25/11')).toBe('2025-11-25') // day first is clear: 25 > 12; past → last year
    expect(p('Dec 1', 'future')).toBe('2026-12-01')
    expect(p('Dec 1')).toBe('2025-12-01')
  })
  it('says when it cannot tell', () => {
    expect(p('banana')).toBeNull()
    expect(p('31 Feb')).toBeNull()
  })
})
