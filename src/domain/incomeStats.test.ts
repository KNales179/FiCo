import { describe, expect, it } from 'vitest'
import { summarizeIncome } from './incomeStats'
import type { Transaction } from '../types/models'

const txn = (over: Partial<Transaction>): Transaction =>
  ({
    id: Math.random().toString(36).slice(2),
    type: 'INCOME',
    currency: 'PHP',
    amountMinor: 100_00,
    occurredAt: '2026-11-02T00:00:00.000Z',
    categoryName: 'Sales',
    createdBy: 'u1',
    ...over,
  }) as Transaction

describe('summarizeIncome', () => {
  it('finds the best day across many small entries', () => {
    const stats = summarizeIncome(
      [
        txn({ occurredAt: '2026-11-02T00:00:00.000Z', amountMinor: 150_00 }),
        txn({ occurredAt: '2026-11-02T00:00:00.000Z', amountMinor: 50_00 }),
        txn({ occurredAt: '2026-11-07T00:00:00.000Z', amountMinor: 500_00 }),
        txn({ occurredAt: '2026-11-08T00:00:00.000Z', amountMinor: 300_00 }),
      ],
      'PHP',
    )
    expect(stats.totalMinor).toBe(1000_00)
    expect(stats.entryCount).toBe(4)
    expect(stats.earningDays).toBe(3)
    expect(stats.bestDay).toEqual({ date: '2026-11-07', amountMinor: 500_00, entries: 1 })
    expect(stats.topDays.map((d) => d.date)).toEqual(['2026-11-07', '2026-11-08', '2026-11-02'])
    expect(stats.avgPerEarningDayMinor).toBe(33333)
    expect(stats.avgPerEntryMinor).toBe(250_00)
  })

  it('groups by weekday, Monday first, averaging over days that earned', () => {
    // 2026-11-02 and 2026-11-09 are Mondays; 2026-11-07 is a Saturday.
    const stats = summarizeIncome(
      [
        txn({ occurredAt: '2026-11-02T00:00:00.000Z', amountMinor: 100_00 }),
        txn({ occurredAt: '2026-11-09T00:00:00.000Z', amountMinor: 300_00 }),
        txn({ occurredAt: '2026-11-07T00:00:00.000Z', amountMinor: 500_00 }),
      ],
      'PHP',
    )
    expect(stats.byWeekday).toHaveLength(7)
    expect(stats.byWeekday[0]).toMatchObject({ totalMinor: 400_00, earningDays: 2, avgMinor: 200_00 })
    expect(stats.byWeekday[5]).toMatchObject({ totalMinor: 500_00, earningDays: 1, avgMinor: 500_00 })
    expect(stats.byWeekday[6]).toMatchObject({ totalMinor: 0, earningDays: 0, avgMinor: 0 })
  })

  it('ignores expenses, transfers and other currencies, and ranks sources', () => {
    const stats = summarizeIncome(
      [
        txn({ amountMinor: 300_00, categoryName: 'Sales' }),
        txn({ amountMinor: 100_00, categoryName: 'Tips' }),
        txn({ amountMinor: 50_00, categoryName: null }),
        txn({ type: 'EXPENSE', amountMinor: 999_00 }),
        txn({ type: 'TRANSFER', amountMinor: 999_00 }),
        txn({ currency: 'USD', amountMinor: 999_00 }),
      ],
      'PHP',
    )
    expect(stats.totalMinor).toBe(450_00)
    expect(stats.bySource.map((s) => s.name)).toEqual(['Sales', 'Tips', 'Uncategorized'])
  })

  it('ranks the accounts the income landed in', () => {
    const stats = summarizeIncome(
      [
        txn({ accountId: 'siomai', amountMinor: 120_00 }),
        txn({ accountId: 'siomai', amountMinor: 80_00 }),
        txn({ accountId: 'drinks', amountMinor: 300_00 }),
      ],
      'PHP',
    )
    expect(stats.byAccount).toEqual([
      { accountId: 'drinks', amountMinor: 300_00, entries: 1, pct: 60 },
      { accountId: 'siomai', amountMinor: 200_00, entries: 2, pct: 40 },
    ])
  })

  it('leaves out an account’s starting balance', () => {
    const stats = summarizeIncome(
      [
        txn({ amountMinor: 25000_00, sourceType: 'OPENING_BALANCE', categoryName: null }),
        txn({ occurredAt: '2026-11-03T00:00:00.000Z', amountMinor: 200_00 }),
      ],
      'PHP',
    )
    expect(stats.totalMinor).toBe(200_00)
    expect(stats.bestDay?.date).toBe('2026-11-03')
    expect(stats.bySource.map((s) => s.name)).toEqual(['Sales'])
  })

  it('leaves out private records, like the shared totals do', () => {
    const stats = summarizeIncome(
      [txn({ amountMinor: 500_00, visibility: 'PRIVATE' }), txn({ amountMinor: 100_00 })],
      'PHP',
    )
    expect(stats.totalMinor).toBe(100_00)
  })

  it('is empty and safe with no income', () => {
    const stats = summarizeIncome([txn({ type: 'EXPENSE' })], 'PHP')
    expect(stats.bestDay).toBeNull()
    expect(stats.earningDays).toBe(0)
    expect(stats.avgPerEarningDayMinor).toBe(0)
    expect(stats.bySource).toEqual([])
  })
})
