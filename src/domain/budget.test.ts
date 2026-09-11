import { describe, expect, it } from 'vitest'
import {
  allocateBudget,
  averageMinor,
  detectTrend,
  findOverdueBills,
  medianMinor,
  nextPeriod,
  periodRangeIso,
  priorPeriods,
  projectBillsForPeriod,
  rankWeeklyCategories,
  recommendBillAmount,
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

  it('prefers a recommended amount (from payment history) over the static expected amount', () => {
    const rows = projectBillsForPeriod([bill({ expectedAmountMinor: 10000 })], '2026-10', {
      b1: 12500,
    })
    expect(rows[0].amountMinor).toBe(12500)
  })
})

describe('findOverdueBills', () => {
  it('finds an active bill whose due date already passed', () => {
    const rows = findOverdueBills(
      [bill({ nextDueDate: '2026-09-01T00:00:00.000Z' })],
      '2026-10-05T00:00:00.000Z',
    )
    expect(rows).toEqual([
      { billId: 'b1', name: 'Bill', dueDate: '2026-09-01T00:00:00.000Z', amountMinor: 10000 },
    ])
  })

  it('is not overdue when the due date is still ahead, and skips inactive bills', () => {
    expect(
      findOverdueBills([bill({ nextDueDate: '2026-11-01T00:00:00.000Z' })], '2026-10-05T00:00:00.000Z'),
    ).toHaveLength(0)
    expect(
      findOverdueBills(
        [bill({ active: false, nextDueDate: '2026-09-01T00:00:00.000Z' })],
        '2026-10-05T00:00:00.000Z',
      ),
    ).toHaveLength(0)
  })
})

describe('recommendBillAmount', () => {
  it('averages up to the last 3 payments, most recent last', () => {
    expect(recommendBillAmount([1000, 1200, 1100, 1300])).toBe(averageMinor([1200, 1100, 1300]))
  })

  it('is null with no payment history — never a guess', () => {
    expect(recommendBillAmount([])).toBeNull()
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

describe('medianMinor', () => {
  it('is the middle value, unmoved by one outlier', () => {
    expect(medianMinor([100, 100, 100, 100, 100000])).toBe(100)
  })

  it('averages the two middle values for an even count', () => {
    expect(medianMinor([100, 200])).toBe(150)
  })

  it('is 0 for an empty list', () => {
    expect(medianMinor([])).toBe(0)
  })
})

describe('rankWeeklyCategories', () => {
  const txn = (over: {
    occurredAt: string
    amountMinor: number
    categoryName?: string | null
  }) => ({
    type: 'EXPENSE',
    sourceType: 'MANUAL',
    categoryName: null,
    ...over,
  })

  it('ranks a weekly habit above a one-time purchase, by median not average', () => {
    // Groceries: a real purchase most weeks. Gadget: one big one-off.
    const rows = rankWeeklyCategories(
      [
        txn({ occurredAt: '2026-09-02T00:00:00Z', amountMinor: 3000, categoryName: 'Groceries' }),
        txn({ occurredAt: '2026-09-09T00:00:00Z', amountMinor: 3200, categoryName: 'Groceries' }),
        txn({ occurredAt: '2026-09-16T00:00:00Z', amountMinor: 2900, categoryName: 'Groceries' }),
        txn({ occurredAt: '2026-09-23T00:00:00Z', amountMinor: 3100, categoryName: 'Groceries' }),
        txn({ occurredAt: '2026-09-05T00:00:00Z', amountMinor: 50000, categoryName: 'Gadget' }),
      ],
      '2026-09-01T00:00:00Z',
      4,
    )

    expect(rows[0].categoryName).toBe('Groceries')
    expect(rows[0].weeklyMedianMinor).toBe(3050)
    // Bought in only 1 of 4 weeks -> most weeks are 0 -> median is 0 -> dropped entirely.
    expect(rows.find((r) => r.categoryName === 'Gadget')).toBeUndefined()
  })

  it('excludes bill payments and income from the weekly breakdown', () => {
    const rows = rankWeeklyCategories(
      [
        {
          ...txn({ occurredAt: '2026-09-02T00:00:00Z', amountMinor: 1000, categoryName: 'Bills' }),
          sourceType: 'BILL_PAYMENT',
        },
        { ...txn({ occurredAt: '2026-09-02T00:00:00Z', amountMinor: 5000 }), type: 'INCOME' },
      ],
      '2026-09-01T00:00:00Z',
      4,
    )
    expect(rows).toHaveLength(0)
  })

  it('ignores a transaction outside the sampled window', () => {
    const rows = rankWeeklyCategories(
      [txn({ occurredAt: '2025-01-01T00:00:00Z', amountMinor: 1000, categoryName: 'Food' })],
      '2026-09-01T00:00:00Z',
      4,
    )
    expect(rows).toHaveLength(0)
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
  it('carves out bills, planned items and weekly staples, splitting the rest across the weeks', () => {
    const result = allocateBudget({
      incomeMinor: 3000000,
      projectedBills: [{ amountMinor: 800000 }, { amountMinor: 200000 }],
      plannedItems: [{ name: 'School', amountMinor: 500000 }],
      weeklyStaples: [{ name: 'Groceries', amountMinor: 30000 }],
      period: '2026-10',
    })
    expect(result.billsTotalMinor).toBe(1000000)
    expect(result.plannedTotalMinor).toBe(500000)
    expect(result.weeklyStaplesTotalMinor).toBe(30000)
    expect(result.weeks).toBe(5)
    // 3,000,000 - 1,000,000 - 500,000 - (30,000 * 5) = 1,350,000
    expect(result.remainingMinor).toBe(1350000)
    expect(result.weeklyDiscretionaryMinor).toBe(270000)
    expect(result.weeklyBudgetMinor).toBe(300000) // staples + discretionary
    expect(result.overBudget).toBe(false)
  })

  it('works with no weekly staples at all', () => {
    const result = allocateBudget({
      incomeMinor: 100000,
      projectedBills: [],
      plannedItems: [],
      weeklyStaples: [],
      period: '2026-10',
    })
    expect(result.weeklyStaplesTotalMinor).toBe(0)
    expect(result.weeklyBudgetMinor).toBe(result.weeklyDiscretionaryMinor)
  })

  it('flags over-budget when bills, planned and staples alone exceed income', () => {
    const result = allocateBudget({
      incomeMinor: 100000,
      projectedBills: [{ amountMinor: 90000 }],
      plannedItems: [{ name: 'Extra', amountMinor: 50000 }],
      weeklyStaples: [],
      period: '2026-10',
    })
    expect(result.remainingMinor).toBeLessThan(0)
    expect(result.overBudget).toBe(true)
  })
})
