import type {
  Bill,
  BillPayment,
  ElectricityRecord,
} from '../types/models'
import { createRepository } from './createRepository'

const bills = createRepository('bills')
const billPayments = createRepository('billPayments')
const electricityRecords = createRepository('electricityRecords')

export const billRepository = {
  ...bills,

  async listBySpace(spaceId: string): Promise<Bill[]> {
    return bills.getAllByIndex('by-spaceId', spaceId)
  },

  async listActive(spaceId: string): Promise<Bill[]> {
    const rows = await bills.getAllByIndex('by-spaceId', spaceId)
    return rows.filter((bill) => bill.active)
  },

  /** Active bills in a space due on or before `beforeIso`, earliest first
   *  (§15). A NONE bill has no due date to compare, so it's never included
   *  here — the dashboard/upcoming views that want it shown unconditionally
   *  (it's always payable) filter for it separately. */
  async listUpcoming(
    spaceId: string,
    beforeIso: string,
  ): Promise<Bill[]> {
    const rows = await bills.getAllByIndex('by-spaceId', spaceId)
    return rows
      .filter(
        (bill): bill is Bill & { nextDueDate: string } =>
          bill.active && bill.nextDueDate != null && bill.nextDueDate <= beforeIso,
      )
      .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate))
  },

  /** Deleted bills in a space — so an accidental delete can be found and undone. */
  async listDeleted(spaceId: string): Promise<Bill[]> {
    const rows = await bills.getAllByIndex('by-spaceId', spaceId, {
      includeDeleted: true,
    })
    return rows.filter((bill) => bill.deletedAt)
  },
}

export const billPaymentRepository = {
  ...billPayments,

  async listByBill(billId: string): Promise<BillPayment[]> {
    const rows = await billPayments.getAllByIndex('by-billId', billId)
    return rows.sort((a, b) => b.paidAt.localeCompare(a.paidAt))
  },
}

export const electricityRecordRepository = {
  ...electricityRecords,

  async getByBillPayment(
    billPaymentId: string,
  ): Promise<ElectricityRecord | undefined> {
    return electricityRecords.getByIndex(
      'by-billPaymentId',
      billPaymentId,
    )
  },

  /** All electricity records, newest billing period first (for history/charts §16). */
  async listByPeriodDesc(): Promise<ElectricityRecord[]> {
    const rows = await electricityRecords.getAll()
    return rows.sort((a, b) =>
      b.billingPeriod.localeCompare(a.billingPeriod),
    )
  },
}
