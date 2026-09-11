import { createContext } from 'react'
import type {
  Bill,
  BillPayment,
  ElectricityRecord,
} from '../types/models'
import type { NewBillInput, PayBillInput } from '../features/bills'

export interface BillsContextValue {
  bills: Bill[]
  electricity: ElectricityRecord[]
  loading: boolean
  error: string | null
  canEdit: boolean
  refresh: () => Promise<void>
  createBill: (input: NewBillInput) => Promise<void>
  updateBill: (
    id: string,
    patch: Partial<NewBillInput> & { active?: boolean },
  ) => Promise<void>
  deleteBill: (id: string) => Promise<void>
  payBill: (
    billId: string,
    input: PayBillInput,
  ) => Promise<void>
  paymentsFor: (billId: string) => Promise<BillPayment[]>
  deletePayment: (paymentId: string) => Promise<void>
}

export const BillsContext = createContext<BillsContextValue | undefined>(
  undefined,
)
