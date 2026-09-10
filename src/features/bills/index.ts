import {
  billPaymentRepository,
  billRepository,
  electricityRecordRepository,
} from '../../repositories'
import { recordTransaction } from '../money'
import { enqueueMutation } from '../sync/enqueue'
import type { MutationContext } from '../sync/context'
import { advanceDueDate, periodKey } from '../../domain/bills'
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
    categoryId: null,
    categoryName: input.categoryName ?? null,
    paymentAccountId: input.paymentAccountId ?? null,
    active: true,
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
      | 'categoryName'
      | 'paymentAccountId'
      | 'active'
    >
  >,
): Promise<Bill> => {
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

export { advanceDueDate, periodKey } from '../../domain/bills'
