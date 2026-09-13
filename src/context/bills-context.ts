import { createContext } from 'react'
import type {
  Bill,
  BillPayment,
  ElectricityRecord,
} from '../types/models'
import type { NewBillInput, PayBillInput } from '../features/bills'

export interface BillsContextValue {
  bills: Bill[]
  deletedBills: Bill[]
  electricity: ElectricityRecord[]
  loading: boolean
  error: string | null
  canEdit: boolean
  refresh: () => Promise<void>
  createBill: (input: NewBillInput) => Promise<void>
  updateBill: (
    id: string,
    // scheduledDates is widened to allow `null` (not just omitted) so
    // switching a bill's recurrence away from SCHEDULED can actually clear
    // its old dates, not just leave them stale and unused.
    patch: Partial<Omit<NewBillInput, 'scheduledDates'>> & {
      active?: boolean
      scheduledDates?: string[] | null
    },
  ) => Promise<void>
  deleteBill: (id: string) => Promise<void>
  restoreBill: (id: string) => Promise<void>
  payBill: (
    billId: string,
    input: PayBillInput,
  ) => Promise<void>
  paymentsFor: (billId: string) => Promise<BillPayment[]>
  deletePayment: (paymentId: string) => Promise<void>
  /** SCHEDULED only — appends one more date to a bill's calendar. */
  addScheduledDate: (billId: string, dateIso: string) => Promise<void>
}

export const BillsContext = createContext<BillsContextValue | undefined>(
  undefined,
)
