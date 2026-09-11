import { beforeEach, describe, expect, it } from 'vitest'
import { ctx, withDB } from '../../test/helpers'
import { createAccount, recordTransaction } from '../money'
import { createBill, payBill } from '../bills'
import { getBudgetPlan, recommendBudget, saveBudgetPlan } from './index'

const c = ctx()

describe('budget planning (Roadmap Phase 26 feedback)', () => {
  beforeEach(withDB)

  it('recommends income, variable spend and bill projections from history alone', async () => {
    const cash = await createAccount(c, {
      name: 'Cash',
      type: 'CASH',
      openingBalanceMinor: 0,
    })

    // Three prior months of income + non-bill spending.
    for (const month of ['2026-07', '2026-08', '2026-09']) {
      await recordTransaction(c, {
        type: 'INCOME',
        amountMinor: 3000000,
        title: 'Salary',
        accountId: cash.id,
        occurredAt: `${month}-05T00:00:00.000Z`,
      })
      await recordTransaction(c, {
        type: 'EXPENSE',
        amountMinor: 500000,
        title: 'Groceries',
        accountId: cash.id,
        occurredAt: `${month}-10T00:00:00.000Z`,
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
    expect(rec.averageVariableSpendingMinor).toBe(500000)
    expect(rec.projectedBills).toHaveLength(1)
    expect(rec.projectedBills[0].name).toBe('Electricity')
    expect(rec.billTrends[bill.id]).toBe('up')
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

  it('saveBudgetPlan creates then updates the same period, never duplicating it', async () => {
    const first = await saveBudgetPlan(c, '2026-10', {
      expectedIncomeMinor: 3000000,
      plannedItems: [{ id: 'p1', name: 'School', amountMinor: 500000 }],
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

    const stored = await getBudgetPlan(c.spaceId, '2026-10')
    expect(stored?.id).toBe(first.id)
    expect(stored?.plannedItems).toHaveLength(2)
  })
})
