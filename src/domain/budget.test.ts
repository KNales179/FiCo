import { describe, expect, it } from 'vitest'
import {
  allocateBudget,
  averageMinor,
  detectTrend,
  nextPeriod,
  periodRangeIso,
  priorPeriods,
  projectBillsForPeriod,
  weeksInPeriod,
} from './budget'
import type { Bill } from '../types/models'

const bill = (over: Partial<Bill>): Bill =>
  ({
    id: 'b1',
    spaceId: 's',
    name: 'Bill',
    recurrence: 'MONTHLY',
    billType: 'FIXED',
    expectedAmountMinor: 10000,
    nextDueDate: '2026-10-15T00:00:00.000Z',
    active: true,
    visibility: 'SPACE',
    createdBy: 'u',
    tracksElectricity: false,
    createdAt: '',
    updatedAt: '',
    syncStatus: 'SYNCED',
    version: 1,
    ...over,
  }) as Bill

describe('projectBillsForPeriod', () => {
  it('projects a monthly bill into the target period', () => {
    const rows = projectBillsForPeriod([bill({})], '2026-10')
    expect(rows).toEqual([
      { billId: 'b1', name: 'Bill', amountMinor: 10000, dueDate: '2026-10-15T00:00:00.000Z' },
    ])
  })

  it('walks a monthly bill forward to reach a later period', () => {
    const rows = projectBillsForPeriod(
      [bill({ nextDueDate: '2026-08-15T00:00:00.000Z' })],
      '2026-10',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].dueDate.slice(0, 7)).toBe('2026-10')
  })

  it('a yearly bill only lands in its own month', () => {
    const rows = projectBillsForPeriod(
      [bill({ recurrence: 'YEARLY', nextDueDate: '2026-03-01T00:00:00.000Z' })],
      '2026-10',
    )
    expect(rows).toHaveLength(0)
  })

  it('skips an inactive bill', () => {
    expect(projectBillsForPeriod([bill({ active: false })], '2026-10')).toHaveLength(0)
  })

  it('contributes 0, not a guess, when a bill has no expected amount yet', () => {
    const rows = projectBillsForPeriod(
      [bill({ expectedAmountMinor: null })],
      '2026-10',
    )
    expect(rows[0].amountMinor).toBe(0)
  })
})

describe('averageMinor / detectTrend', () => {
  it('averages, rounding to the nearest minor unit', () => {
    expect(averageMinor([100, 101])).toBe(101)
    expect(averageMinor([])).toBe(0)
  })

  it('flags a rising bill', () => {
    expect(detectTrend([1000, 1000, 1300])).toBe('up')
  })

  it('flags a falling bill', () => {
    expect(detectTrend([1000, 1000, 700])).toBe('down')
  })

  it('calls a small change flat', () => {
    expect(detectTrend([1000, 1030])).toBe('flat')
  })

  it('refuses to guess with fewer than two points', () => {
    expect(detectTrend([1000])).toBeNull()
    expect(detectTrend([])).toBeNull()
  })
})

describe('weeksInPeriod / nextPeriod', () => {
  it('splits a 31-day month into 5 weeks and a 28-day month into 4', () => {
    expect(weeksInPeriod('2026-10')).toBe(5)
    expect(weeksInPeriod('2026-02')).toBe(4)
  })

  it('rolls over into January', () => {
    expect(nextPeriod(new Date('2026-12-15T00:00:00Z'))).toBe('2027-01')
  })
})

describe('priorPeriods / periodRangeIso', () => {
  it('lists the n periods before, oldest first, across a year boundary', () => {
    expect(priorPeriods('2026-02', 3)).toEqual(['2025-11', '2025-12', '2026-01'])
  })

  it('bounds a period from its first instant to its last', () => {
    const [from, to] = periodRangeIso('2026-02')
    expect(from).toBe('2026-02-01T00:00:00.000Z')
    expect(to).toBe('2026-02-28T23:59:59.999Z')
  })
})

describe('allocateBudget', () => {
  it('carves out bills and planned items, splits the rest across the weeks', () => {
    const result = allocateBudget({
      incomeMinor: 3000000,
      projectedBills: [{ amountMinor: 800000 }, { amountMinor: 200000 }],
      plannedItems: [{ name: 'School', amountMinor: 500000 }],
      period: '2026-10',
    })
    expect(result.billsTotalMinor).toBe(1000000)
    expect(result.plannedTotalMinor).toBe(500000)
    expect(result.remainingMinor).toBe(1500000)
    expect(result.weeks).toBe(5)
    expect(result.weeklyBudgetMinor).toBe(300000)
    expect(result.overBudget).toBe(false)
  })

  it('flags over-budget when bills and planned items exceed income', () => {
    const result = allocateBudget({
      incomeMinor: 100000,
      projectedBills: [{ amountMinor: 90000 }],
      plannedItems: [{ name: 'Extra', amountMinor: 50000 }],
      period: '2026-10',
    })
    expect(result.remainingMinor).toBeLessThan(0)
    expect(result.overBudget).toBe(true)
  })
})
