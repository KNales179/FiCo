import { beforeEach, describe, expect, it } from 'vitest'
import { ctx, withDB } from '../../test/helpers'
import { billPaymentRepository, billRepository } from '../../repositories'
import {
  createAccount,
  computeSpaceBalances,
  listTransactions,
  recordTransaction,
} from '../money'
import {
  advanceDueDate,
  createBill,
  deleteBill,
  deleteBillPayment,
  getBill,
  listBillPayments,
  listBills,
  listDeletedBills,
  listElectricity,
  payBill,
  periodKey,
  restoreBill,
  updateBill,
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
    await payBill(c, bill.id, {
      amountMinor: 30000,
      accountId: cash.id,
      paidAt: '2026-05-01T00:00:00.000Z',
    })
    await payBill(c, bill.id, {
      amountMinor: 31000,
      accountId: cash.id,
      paidAt: '2026-06-01T00:00:00.000Z',
    })

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
    await payBill(c, bill.id, {
      amountMinor: 30000,
      accountId: cash.id,
      paidAt: '2026-05-01T00:00:00.000Z',
    })

    await updateBill(c, bill.id, {
      nextDueDate: '2026-05-01T00:00:00.000Z',
    })

    await expect(
      payBill(c, bill.id, {
        amountMinor: 30000,
        accountId: cash.id,
        paidAt: '2026-05-01T00:00:00.000Z',
      }),
    ).rejects.toThrow(/already been paid/i)
    expect(await listBillPayments(bill.id)).toHaveLength(1)
  })

  it('deleting a mis-paid bill undoes the expense and rolls the due date back for correction', async () => {
    const cash = await createAccount(c, {
      name: 'Cash',
      type: 'CASH',
      openingBalanceMinor: 1000000,
    })
    // Set up wrong on purpose — mirrors a bill created with the wrong due
    // date, then paid before anyone noticed. That's the exact shape
    // `payBill`'s own payability guard now refuses going forward, so the
    // mis-paid state here is built directly at the repository layer
    // instead — this test is about `deleteBillPayment`'s rollback, not
    // about re-testing early-payment behavior.
    const bill = await createBill(c, {
      name: 'Electric',
      recurrence: 'MONTHLY',
      billType: 'VARIABLE',
      nextDueDate: '2026-10-01T00:00:00.000Z',
    })
    const paidAt = '2026-09-11T00:00:00.000Z'
    const txn = await recordTransaction(c, {
      type: 'EXPENSE',
      amountMinor: 300000,
      title: bill.name,
      accountId: cash.id,
      occurredAt: paidAt,
      sourceType: 'BILL_PAYMENT',
      sourceId: bill.id,
    })
    const payment = await billPaymentRepository.create({
      spaceId: c.spaceId,
      billId: bill.id,
      amountMinor: 300000,
      paidAt,
      periodKey: periodKey(bill.nextDueDate, bill.recurrence),
      accountId: cash.id,
      transactionId: txn.id,
      createdBy: c.userId,
      syncStatus: 'PENDING',
      version: 1,
    })
    await billRepository.update(bill.id, {
      nextDueDate: advanceDueDate(bill.nextDueDate, bill.recurrence),
      syncStatus: 'PENDING',
    })

    const afterPay = await getBill(bill.id)
    expect(afterPay?.nextDueDate.slice(0, 10)).toBe('2026-11-01')

    const rolledBack = await deleteBillPayment(c, payment.id)
    expect(rolledBack.nextDueDate.slice(0, 10)).toBe('2026-10-01')

    // The linked expense is gone (balance restored) and the payment no
    // longer counts toward history.
    const bal = await computeSpaceBalances(c.spaceId)
    expect(bal.accounts[0].balanceMinor).toBe(1000000)
    const payments = await listBillPayments(bill.id)
    expect(payments.filter((p) => !p.deletedAt)).toHaveLength(0)

    // Now the corrected due date can be edited and paid for real, within
    // the payable window this time.
    await updateBill(c, bill.id, { nextDueDate: '2026-09-30T00:00:00.000Z' })
    const { bill: paidAgain } = await payBill(c, bill.id, {
      amountMinor: 310000,
      accountId: cash.id,
      paidAt: '2026-09-25T00:00:00.000Z',
    })
    expect(paidAgain.nextDueDate.slice(0, 10)).toBe('2026-10-30')
  })

  it('refuses to undo a payment that is no longer the most recent one', async () => {
    const cash = await createAccount(c, { name: 'Cash', type: 'CASH' })
    const bill = await createBill(c, {
      name: 'Water',
      recurrence: 'MONTHLY',
      billType: 'VARIABLE',
      nextDueDate: '2026-05-01T00:00:00.000Z',
    })
    const { payment: first } = await payBill(c, bill.id, {
      amountMinor: 30000,
      accountId: cash.id,
      paidAt: '2026-05-01T00:00:00.000Z',
    })
    await payBill(c, bill.id, {
      amountMinor: 31000,
      accountId: cash.id,
      paidAt: '2026-06-01T00:00:00.000Z',
    })

    await expect(deleteBillPayment(c, first.id)).rejects.toThrow(/most recent/i)
  })

  it('a mistakenly deleted bill can be found and restored, payment history intact', async () => {
    const cash = await createAccount(c, { name: 'Cash', type: 'CASH' })
    const bill = await createBill(c, {
      name: 'Electric',
      recurrence: 'MONTHLY',
      billType: 'VARIABLE',
      nextDueDate: '2026-10-01T00:00:00.000Z',
    })
    await payBill(c, bill.id, {
      amountMinor: 401500,
      accountId: cash.id,
      paidAt: '2026-10-01T00:00:00.000Z',
    })

    await deleteBill(c, bill.id)
    expect(await listBills(c.spaceId)).toHaveLength(0)
    const deleted = await listDeletedBills(c.spaceId)
    expect(deleted).toHaveLength(1)
    expect(deleted[0].name).toBe('Electric')

    const restored = await restoreBill(c, bill.id)
    expect(restored.active).toBe(true)
    expect(restored.deletedAt).toBeFalsy()
    expect(await listDeletedBills(c.spaceId)).toHaveLength(0)
    expect(await listBills(c.spaceId)).toHaveLength(1)
    // The payment made before deletion is still there, untouched.
    expect(await listBillPayments(bill.id)).toHaveLength(1)
  })

  it('a bill created with a category passes it on to the transactions it creates', async () => {
    const cash = await createAccount(c, { name: 'Cash', type: 'CASH' })
    const bill = await createBill(c, {
      name: 'Wifi',
      recurrence: 'MONTHLY',
      billType: 'FIXED',
      nextDueDate: '2026-05-01T00:00:00.000Z',
      categoryId: 'cat-1',
      categoryName: 'Bills',
    })
    await payBill(c, bill.id, {
      amountMinor: 129900,
      accountId: cash.id,
      paidAt: '2026-05-01T00:00:00.000Z',
    })

    const expenses = await listTransactions(c.spaceId, { type: 'EXPENSE' })
    expect(expenses[0].categoryName).toBe('Bills')
  })

  it('setting a category on an existing bill only shapes the next payment, never past ones (§10)', async () => {
    const cash = await createAccount(c, { name: 'Cash', type: 'CASH' })
    const bill = await createBill(c, {
      name: 'Electric',
      recurrence: 'MONTHLY',
      billType: 'VARIABLE',
      nextDueDate: '2026-09-01T00:00:00.000Z',
    })
    // Paid before the bill ever had a category — recorded uncategorized.
    await payBill(c, bill.id, {
      amountMinor: 401500,
      accountId: cash.id,
      paidAt: '2026-09-01T00:00:00.000Z',
    })

    const updated = await updateBill(c, bill.id, {
      categoryId: 'cat-1',
      categoryName: 'Bills',
    })
    expect(updated.categoryName).toBe('Bills')

    // The already-recorded expense keeps the snapshot it was created
    // with — still no category — exactly like an item profile's category
    // change never rewrites its own past purchases.
    const pastExpense = (await listTransactions(c.spaceId, { type: 'EXPENSE' }))[0]
    expect(pastExpense.categoryName).toBeNull()

    // The *next* payment, made after the category was set, picks it up.
    await payBill(c, bill.id, {
      amountMinor: 420000,
      accountId: cash.id,
      paidAt: '2026-10-01T00:00:00.000Z',
    })
    const nextExpense = (await listTransactions(c.spaceId, { type: 'EXPENSE' })).find(
      (t) => t.amountMinor === 420000,
    )
    expect(nextExpense?.categoryName).toBe('Bills')
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
      paidAt: '2026-06-20T00:00:00.000Z',
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
    await payBill(c, bill.id, {
      amountMinor: 55000,
      accountId: cash.id,
      paidAt: '2026-02-10T00:00:00.000Z',
    })
    const after = await getBill(bill.id)
    expect(after?.nextDueDate.slice(0, 10)).toBe('2027-02-10')
  })

  it('refuses to pay a bill more than a week ahead of its due date', async () => {
    const cash = await createAccount(c, { name: 'Cash', type: 'CASH' })
    const bill = await createBill(c, {
      name: 'Rent',
      recurrence: 'MONTHLY',
      billType: 'FIXED',
      nextDueDate: '2026-10-01T00:00:00.000Z',
    })

    await expect(
      payBill(c, bill.id, {
        amountMinor: 500000,
        accountId: cash.id,
        paidAt: '2026-09-11T00:00:00.000Z',
      }),
    ).rejects.toThrow(/not payable yet/i)
    expect(await listBillPayments(bill.id)).toHaveLength(0)
  })

  it('allows paying right at the start of the payable window, and an overdue bill any time', async () => {
    const cash = await createAccount(c, { name: 'Cash', type: 'CASH' })
    const bill = await createBill(c, {
      name: 'Rent',
      recurrence: 'MONTHLY',
      billType: 'FIXED',
      nextDueDate: '2026-10-01T00:00:00.000Z',
    })

    // Exactly 7 days early — the edge of the window.
    const { bill: afterFirst } = await payBill(c, bill.id, {
      amountMinor: 500000,
      accountId: cash.id,
      paidAt: '2026-09-24T00:00:00.000Z',
    })
    expect(afterFirst.nextDueDate.slice(0, 10)).toBe('2026-11-01')

    // Next occurrence is due 2026-11-01 — paying it months late (overdue)
    // is always allowed, no matter how far past the window.
    const { bill: afterSecond } = await payBill(c, bill.id, {
      amountMinor: 500000,
      accountId: cash.id,
      paidAt: '2027-02-01T00:00:00.000Z',
    })
    expect(afterSecond.nextDueDate.slice(0, 10)).toBe('2026-12-01')
  })
})
