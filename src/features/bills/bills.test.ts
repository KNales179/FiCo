import { beforeEach, describe, expect, it } from 'vitest'
import { ctx, withDB } from '../../test/helpers'
import { createAccount, computeSpaceBalances, listTransactions } from '../money'
import {
  createBill,
  getBill,
  listBillPayments,
  listElectricity,
  payBill,
} from './index'

const c = ctx()

describe('bills (Phase 11)', () => {
  beforeEach(withDB)

  it('paying a bill creates one expense and advances the due date', async () => {
    const cash = await createAccount(c, {
      name: 'Cash',
      type: 'CASH',
      openingBalanceMinor: 1000000,
    })
    const bill = await createBill(c, {
      name: 'Internet',
      recurrence: 'MONTHLY',
      billType: 'FIXED',
      nextDueDate: '2026-03-15T00:00:00.000Z',
      categoryName: 'Bills',
    })

    const { bill: updated } = await payBill(c, bill.id, {
      amountMinor: 149900,
      accountId: cash.id,
      paidAt: '2026-03-14T00:00:00.000Z',
    })

    expect(updated.nextDueDate.slice(0, 10)).toBe('2026-04-15')
    // FIXED bills learn their real amount from the payment.
    expect(updated.expectedAmountMinor).toBe(149900)

    const expenses = await listTransactions(c.spaceId, { type: 'EXPENSE' })
    expect(expenses).toHaveLength(1)
    expect(expenses[0]).toMatchObject({
      title: 'Internet',
      amountMinor: 149900,
      sourceType: 'BILL_PAYMENT',
      sourceId: bill.id,
      categoryName: 'Bills',
    })

    const bal = await computeSpaceBalances(c.spaceId)
    expect(bal.accounts[0].balanceMinor).toBe(850100)
  })

  it('paying twice in a row settles two consecutive occurrences', async () => {
    const cash = await createAccount(c, { name: 'Cash', type: 'CASH' })
    const bill = await createBill(c, {
      name: 'Water',
      recurrence: 'MONTHLY',
      billType: 'VARIABLE',
      nextDueDate: '2026-05-01T00:00:00.000Z',
    })
    await payBill(c, bill.id, { amountMinor: 30000, accountId: cash.id })
    await payBill(c, bill.id, { amountMinor: 31000, accountId: cash.id })

    const payments = await listBillPayments(bill.id)
    expect(payments.map((p) => p.periodKey).sort()).toEqual([
      '2026-05',
      '2026-06',
    ])
    const after = await getBill(bill.id)
    expect(after?.nextDueDate.slice(0, 10)).toBe('2026-07-01')
  })

  it('refuses to re-pay an occurrence whose due date was rolled back', async () => {
    const cash = await createAccount(c, { name: 'Cash', type: 'CASH' })
    const bill = await createBill(c, {
      name: 'Water',
      recurrence: 'MONTHLY',
      billType: 'VARIABLE',
      nextDueDate: '2026-05-01T00:00:00.000Z',
    })
    await payBill(c, bill.id, { amountMinor: 30000, accountId: cash.id })

    const { updateBill } = await import('./index')
    await updateBill(c, bill.id, {
      nextDueDate: '2026-05-01T00:00:00.000Z',
    })

    await expect(
      payBill(c, bill.id, { amountMinor: 30000, accountId: cash.id }),
    ).rejects.toThrow(/already been paid/i)
    expect(await listBillPayments(bill.id)).toHaveLength(1)
  })

  it('an electricity-tracking bill stores a meter record on payment', async () => {
    const cash = await createAccount(c, { name: 'Cash', type: 'CASH' })
    const bill = await createBill(c, {
      name: 'Meralco',
      recurrence: 'MONTHLY',
      billType: 'VARIABLE',
      nextDueDate: '2026-06-20T00:00:00.000Z',
      tracksElectricity: true,
    })
    await payBill(c, bill.id, {
      amountMinor: 254300,
      accountId: cash.id,
      electricity: { consumptionKwh: 210, energyChargeMinor: 180000 },
    })

    const records = await listElectricity(c.spaceId)
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      consumptionKwh: 210,
      amountMinor: 254300,
    })
  })

  it('yearly bills advance by a year', async () => {
    const cash = await createAccount(c, { name: 'Cash', type: 'CASH' })
    const bill = await createBill(c, {
      name: 'Domain',
      recurrence: 'YEARLY',
      billType: 'FIXED',
      nextDueDate: '2026-02-10T00:00:00.000Z',
    })
    await payBill(c, bill.id, { amountMinor: 55000, accountId: cash.id })
    const after = await getBill(bill.id)
    expect(after?.nextDueDate.slice(0, 10)).toBe('2027-02-10')
  })
})
