import { describe, expect, it } from 'vitest'
import { buildMonth, keyOf } from './index'
import type { Bill, Transaction } from '../../types/models'

const tx = (over: Partial<Transaction>): Transaction =>
  ({
    id: Math.random().toString(36).slice(2),
    spaceId: 's',
    type: 'EXPENSE',
    amountMinor: 1000,
    currency: 'PHP',
    title: 'x',
    accountId: 'a',
    occurredAt: new Date(2026, 10, 5, 12).toISOString(),
    sourceType: 'MANUAL',
    visibility: 'SPACE',
    createdBy: 'u',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as Transaction

const bill = (over: Partial<Bill>): Bill => ({ id: 'b1', name: 'Water', active: true, nextDueDate: '2026-11-20', ...over }) as Bill

describe('money calendar', () => {
  it('lays November 2026 out from Sunday, 30 days', () => {
    const m = buildMonth(2026, 11, { transactions: [], bills: [], paydays: [] })
    expect(m.days).toHaveLength(30)
    expect(m.leading).toBe(0) // Nov 1 2026 is a Sunday
  })

  it('marks paydays, with 31 meaning the last day', () => {
    const m = buildMonth(2026, 11, { transactions: [], bills: [], paydays: [15, 31] })
    expect(m.days.filter((d) => d.payday).map((d) => d.day)).toEqual([15, 30])
  })

  it('splits bill payments from other records, and totals spent and received', () => {
    const m = buildMonth(2026, 11, {
      transactions: [
        tx({ title: 'Lunch', amountMinor: 15000 }),
        tx({ title: 'Meralco', amountMinor: 287400, sourceType: 'BILL_PAYMENT' }),
        tx({ title: 'Salary', type: 'INCOME', amountMinor: 2500000 }),
        tx({ title: 'Move', type: 'TRANSFER', amountMinor: 500000 }),
        tx({ title: 'Start', type: 'INCOME', amountMinor: 999999, sourceType: 'OPENING_BALANCE' }),
      ],
      bills: [],
      paydays: [],
      currency: 'PHP',
    })
    const day5 = m.days[4]
    expect(day5.billsPaid.map((t) => t.title)).toEqual(['Meralco'])
    expect(day5.records.map((t) => t.title)).toEqual(['Lunch', 'Salary', 'Move', 'Start'])
    expect(m.spentMinor).toBe(15000 + 287400)
    expect(m.receivedMinor).toBe(2500000) // a starting balance isn't income
  })

  it('shows bills due on their due date and scheduled dates', () => {
    const m = buildMonth(2026, 11, {
      transactions: [],
      bills: [bill({}), bill({ id: 'b2', name: 'Tuition', nextDueDate: null, scheduledDates: ['2026-11-03'] }), bill({ id: 'b3', active: false })],
      paydays: [],
    })
    expect(m.days[19].billsDue.map((b) => b.name)).toEqual(['Water'])
    expect(m.days[2].billsDue.map((b) => b.name)).toEqual(['Tuition'])
  })

  it('reads plain dates as that day, not shifted by time zone', () => {
    expect(keyOf('2026-11-20')).toBe('2026-11-20')
  })
})
