import { beforeEach, describe, expect, it } from 'vitest'
import { ctx, withDB } from '../../test/helpers'
import { createAccount, recordTransaction } from '../money'
import { createBill, payBill } from '../bills'
import { getBudgetPlan, recommendBudget, saveBudgetPlan } from './index'

const c = ctx()

describe('budget planning (Roadmap Phase 26 feedback)', () => {
  beforeEach(withDB)

  it('recommends a median income and projects a bill from its own recent payments', async () => {
    const cash = await createAccount(c, {
      name: 'Cash',
      type: 'CASH',
      openingBalanceMinor: 0,
    })

    for (const month of ['2026-07', '2026-08', '2026-09']) {
      await recordTransaction(c, {
        type: 'INCOME',
        amountMinor: 3000000,
        title: 'Salary',
        accountId: cash.id,
        occurredAt: `${month}-05T00:00:00.000Z`,
      })
    }

    // A monthly bill, paid the last two months at a rising amount.
    const bill = await createBill(c, {
      name: 'Electricity',
      recurrence: 'MONTHLY',
      billType: 'VARIABLE',
      nextDueDate: '2026-08-15T00:00:00.000Z',
    })
    await payBill(c, bill.id, {
      amountMinor: 100000,
      accountId: cash.id,
      paidAt: '2026-08-14T00:00:00.000Z',
    })
    await payBill(c, bill.id, {
      amountMinor: 150000,
      accountId: cash.id,
      paidAt: '2026-09-14T00:00:00.000Z',
    })

    const rec = await recommendBudget(c.spaceId, '2026-10')

    expect(rec.incomeMinor).toBe(3000000)
    expect(rec.projectedBills).toHaveLength(1)
    expect(rec.projectedBills[0].name).toBe('Electricity')
    // Recommended from the last two payments (100k, 150k), not a flat "expected amount".
    expect(rec.projectedBills[0].amountMinor).toBe(125000)
    expect(rec.billTrends[bill.id]).toBe('up')
    expect(rec.overdueBills).toHaveLength(0)
  })

  it('a bill with no expected amount and no payment history contributes 0, not a guess', async () => {
    await createBill(c, {
      name: 'New subscription',
      recurrence: 'MONTHLY',
      billType: 'FIXED',
      nextDueDate: '2026-10-01T00:00:00.000Z',
    })

    const rec = await recommendBudget(c.spaceId, '2026-10')
    expect(rec.projectedBills[0].amountMinor).toBe(0)
    expect(rec.billTrends[rec.projectedBills[0].billId]).toBeNull()
  })

  it('surfaces an overdue, unpaid bill separately from the projected ones', async () => {
    await createBill(c, {
      name: 'Rent',
      recurrence: 'MONTHLY',
      billType: 'FIXED',
      expectedAmountMinor: 800000,
      nextDueDate: '2026-09-01T00:00:00.000Z',
    })

    const rec = await recommendBudget(
      c.spaceId,
      '2026-10',
      new Date('2026-10-05T00:00:00.000Z'),
    )
    expect(rec.overdueBills).toHaveLength(1)
    expect(rec.overdueBills[0].name).toBe('Rent')
    expect(rec.overdueBills[0].amountMinor).toBe(800000)
  })

  it('ranks a real weekly habit above the rest, from ordinary recorded transactions', async () => {
    const cash = await createAccount(c, { name: 'Cash', type: 'CASH' })

    // Groceries roughly every week for ten weeks leading into October.
    const weeks = [
      '2026-07-24', '2026-07-31', '2026-08-07', '2026-08-14', '2026-08-21',
      '2026-08-28', '2026-09-04', '2026-09-11', '2026-09-18', '2026-09-25',
    ]
    for (const day of weeks) {
      await recordTransaction(c, {
        type: 'EXPENSE',
        amountMinor: 30000,
        title: 'Groceries',
        accountId: cash.id,
        categoryName: 'Groceries',
        occurredAt: `${day}T00:00:00.000Z`,
      })
    }
    // A single unrelated big purchase, once.
    await recordTransaction(c, {
      type: 'EXPENSE',
      amountMinor: 500000,
      title: 'Laptop',
      accountId: cash.id,
      categoryName: 'Shopping',
      occurredAt: '2026-08-10T00:00:00.000Z',
    })

    const rec = await recommendBudget(c.spaceId, '2026-10')
    expect(rec.weeklyCategories[0].categoryName).toBe('Groceries')
    expect(rec.weeklyCategories[0].weeklyMedianMinor).toBe(30000)
    expect(rec.weeklyCategories.find((w) => w.categoryName === 'Shopping')).toBeUndefined()
  })

  it('saveBudgetPlan creates then updates the same period, never duplicating it', async () => {
    const first = await saveBudgetPlan(c, '2026-10', {
      expectedIncomeMinor: 3000000,
      plannedItems: [{ id: 'p1', name: 'School', amountMinor: 500000 }],
      weeklyStaples: [{ id: 'w1', name: 'Groceries', amountMinor: 30000 }],
      includedOverdueBillIds: ['bill-1'],
    })

    const second = await saveBudgetPlan(c, '2026-10', {
      plannedItems: [
        { id: 'p1', name: 'School', amountMinor: 500000 },
        { id: 'p2', name: 'Birthday gift', amountMinor: 200000 },
      ],
    })

    expect(second.id).toBe(first.id)
    expect(second.expectedIncomeMinor).toBe(3000000) // untouched by the second save
    expect(second.plannedItems).toHaveLength(2)
    expect(second.weeklyStaples).toHaveLength(1) // also untouched
    expect(second.includedOverdueBillIds).toEqual(['bill-1'])

    const stored = await getBudgetPlan(c.spaceId, '2026-10')
    expect(stored?.id).toBe(first.id)
    expect(stored?.plannedItems).toHaveLength(2)
  })
})
