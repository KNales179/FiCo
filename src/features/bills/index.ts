import {
  billPaymentRepository,
  billRepository,
  electricityRecordRepository,
  transactionRepository,
} from '../../repositories'
import { recordTransaction } from '../money'
import { enqueueMutation } from '../sync/enqueue'
import type { MutationContext } from '../sync/context'
import { advanceDueDate, periodKey, retreatDueDate } from '../../domain/bills'
import type {
  Bill,
  BillPayment,
  BillRecurrence,
  BillType,
  ElectricityRecord,
} from '../../types/models'

export interface ElectricityDetail {
  consumptionKwh?: number | null
  energyChargeMinor?: number | null
  transmissionMinor?: number | null
  distributionMinor?: number | null
  taxesMinor?: number | null
  otherChargesMinor?: number | null
}

export interface NewBillInput {
  name: string
  recurrence: BillRecurrence
  billType: BillType
  nextDueDate: string
  expectedAmountMinor?: number | null
  categoryId?: string | null
  categoryName?: string | null
  paymentAccountId?: string | null
  tracksElectricity?: boolean
}

export interface PayBillInput {
  amountMinor: number
  accountId: string
  paidAt?: string
  electricity?: ElectricityDetail | null
}

export const listBills = (spaceId: string): Promise<Bill[]> =>
  billRepository.listBySpace(spaceId)

export const upcomingBills = (
  spaceId: string,
  beforeIso: string,
): Promise<Bill[]> => billRepository.listUpcoming(spaceId, beforeIso)

export const getBill = (id: string): Promise<Bill | undefined> =>
  billRepository.get(id)

export const listBillPayments = (
  billId: string,
): Promise<BillPayment[]> => billPaymentRepository.listByBill(billId)

export const listElectricity = async (
  spaceId: string,
): Promise<ElectricityRecord[]> => {
  const all = await electricityRecordRepository.listByPeriodDesc()
  return all.filter((r) => r.spaceId === spaceId)
}

export const createBill = async (
  ctx: MutationContext,
  input: NewBillInput,
): Promise<Bill> => {
  const bill = await billRepository.create({
    spaceId: ctx.spaceId,
    name: input.name.trim(),
    recurrence: input.recurrence,
    billType: input.billType,
    expectedAmountMinor: input.expectedAmountMinor ?? null,
    nextDueDate: input.nextDueDate,
    categoryId: input.categoryId ?? null,
    categoryName: input.categoryName ?? null,
    paymentAccountId: input.paymentAccountId ?? null,
    active: true,
    visibility: 'SPACE',
    createdBy: ctx.userId,
    tracksElectricity: input.tracksElectricity ?? false,
    syncStatus: 'PENDING',
    version: 1,
  })
  await enqueueMutation(ctx, 'bill', bill.id, 'CREATE', bill)
  return bill
}

export const updateBill = async (
  ctx: MutationContext,
  id: string,
  patch: Partial<
    Pick<
      Bill,
      | 'name'
      | 'recurrence'
      | 'billType'
      | 'expectedAmountMinor'
      | 'nextDueDate'
      | 'categoryId'
      | 'categoryName'
      | 'paymentAccountId'
      | 'active'
    >
  >,
): Promise<Bill> => {
  // Deliberately does not touch this bill's already-recorded payments: a
  // transaction's category is a snapshot taken at the time it was created
  // and is never rewritten afterward (§10, same rule an item profile's
  // category follows) — setting or changing a bill's category here only
  // shapes the *next* payment onward, not history.
  const bill = await billRepository.update(id, {
    ...patch,
    syncStatus: 'PENDING',
  })
  await enqueueMutation(ctx, 'bill', id, 'UPDATE', bill)
  return bill
}

export const deleteBill = async (
  ctx: MutationContext,
  id: string,
): Promise<void> => {
  await billRepository.update(id, {
    active: false,
    syncStatus: 'PENDING',
  })
  await billRepository.softDelete(id)
  await enqueueMutation(ctx, 'bill', id, 'DELETE', { id })
}

export const listDeletedBills = (spaceId: string): Promise<Bill[]> =>
  billRepository.listDeleted(spaceId)

/** Undoes `deleteBill` — brings a mistakenly-deleted bill back as active. */
export const restoreBill = async (
  ctx: MutationContext,
  id: string,
): Promise<Bill> => {
  await billRepository.restore(id)
  const updated = await billRepository.update(id, {
    active: true,
    syncStatus: 'PENDING',
  })
  await enqueueMutation(ctx, 'bill', id, 'UPDATE', updated)
  return updated
}

/**
 * Pay the current occurrence of a bill (Roadmap Phase 11, Product Spec §14):
 * records a BillPayment, creates the linked EXPENSE, advances `nextDueDate`.
 * Refuses if this occurrence was already paid — no double payment.
 */
export const payBill = async (
  ctx: MutationContext,
  billId: string,
  input: PayBillInput,
): Promise<{ bill: Bill; payment: BillPayment }> => {
  const bill = await billRepository.get(billId)
  if (!bill || bill.deletedAt) {
    throw new Error('Bill not found')
  }

  const key = periodKey(bill.nextDueDate, bill.recurrence)
  const priorPayments = await billPaymentRepository.listByBill(billId)
  if (priorPayments.some((p) => p.periodKey === key && !p.deletedAt)) {
    throw new Error('This bill period has already been paid')
  }

  const paidAt = input.paidAt ?? new Date().toISOString()

  const txn = await recordTransaction(ctx, {
    type: 'EXPENSE',
    amountMinor: input.amountMinor,
    title: bill.name,
    accountId: input.accountId,
    categoryName: bill.categoryName ?? null,
    occurredAt: paidAt,
    sourceType: 'BILL_PAYMENT',
    sourceId: billId,
  })

  const payment = await billPaymentRepository.create({
    spaceId: ctx.spaceId,
    billId,
    amountMinor: input.amountMinor,
    paidAt,
    periodKey: key,
    accountId: input.accountId,
    transactionId: txn.id,
    createdBy: ctx.userId,
    syncStatus: 'PENDING',
    version: 1,
  })
  await enqueueMutation(ctx, 'billPayment', payment.id, 'PAY', payment)

  if (bill.tracksElectricity && input.electricity) {
    const e = input.electricity
    const record = await electricityRecordRepository.create({
      spaceId: ctx.spaceId,
      billId,
      billPaymentId: payment.id,
      billingPeriod: key,
      amountMinor: input.amountMinor,
      consumptionKwh: e.consumptionKwh ?? null,
      energyChargeMinor: e.energyChargeMinor ?? null,
      transmissionMinor: e.transmissionMinor ?? null,
      distributionMinor: e.distributionMinor ?? null,
      taxesMinor: e.taxesMinor ?? null,
      otherChargesMinor: e.otherChargesMinor ?? null,
      syncStatus: 'PENDING',
      version: 1,
    })
    await enqueueMutation(
      ctx,
      'electricityRecord',
      record.id,
      'CREATE',
      record,
    )
  }

  const updatedBill = await billRepository.update(billId, {
    nextDueDate: advanceDueDate(bill.nextDueDate, bill.recurrence),
    ...(bill.billType === 'FIXED'
      ? { expectedAmountMinor: input.amountMinor }
      : {}),
    syncStatus: 'PENDING',
  })
  await enqueueMutation(ctx, 'bill', billId, 'UPDATE', updatedBill)

  return { bill: updatedBill, payment }
}

/**
 * Undoes a payment: soft-deletes it (and its linked expense and, if any,
 * electricity record), then rolls the bill's due date back to what it was
 * before that payment — so a mis-paid bill (wrong amount, or a due date
 * that was simply set wrong to begin with) can be corrected and re-paid,
 * instead of leaving a permanent, un-fixable record behind.
 *
 * Only the *most recent* payment can be undone — deleting an older one out
 * of order would leave the due-date cursor pointing at neither the deleted
 * occurrence nor a real unpaid one. `payBill`'s own periodKey guard already
 * refuses to re-pay the rolled-back occurrence if something's inconsistent.
 */
export const deleteBillPayment = async (
  ctx: MutationContext,
  paymentId: string,
): Promise<Bill> => {
  const payment = await billPaymentRepository.get(paymentId)
  if (!payment || payment.deletedAt) {
    throw new Error('Payment not found')
  }
  const bill = await billRepository.get(payment.billId)
  if (!bill) {
    throw new Error('Bill not found')
  }

  const rolledBackDueDate = retreatDueDate(bill.nextDueDate, bill.recurrence)
  if (periodKey(rolledBackDueDate, bill.recurrence) !== payment.periodKey) {
    throw new Error(
      'Only the most recent payment on this bill can be undone',
    )
  }

  if (payment.transactionId) {
    await transactionRepository.softDelete(payment.transactionId)
    await enqueueMutation(ctx, 'transaction', payment.transactionId, 'DELETE', {
      id: payment.transactionId,
    })
  }

  const electricityRecord = await electricityRecordRepository.getByBillPayment(
    paymentId,
  )
  if (electricityRecord) {
    await electricityRecordRepository.softDelete(electricityRecord.id)
    await enqueueMutation(ctx, 'electricityRecord', electricityRecord.id, 'DELETE', {
      id: electricityRecord.id,
    })
  }

  await billPaymentRepository.softDelete(paymentId)
  await enqueueMutation(ctx, 'billPayment', paymentId, 'DELETE', { id: paymentId })

  const updatedBill = await billRepository.update(bill.id, {
    nextDueDate: rolledBackDueDate,
    syncStatus: 'PENDING',
  })
  await enqueueMutation(ctx, 'bill', bill.id, 'UPDATE', updatedBill)

  return updatedBill
}

export { advanceDueDate, periodKey } from '../../domain/bills'
