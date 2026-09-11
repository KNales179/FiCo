import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import { ensureDeviceId } from '../features/auth/localAuth'
import {
  createBill as createBillFeature,
  deleteBill as deleteBillFeature,
  deleteBillPayment as deleteBillPaymentFeature,
  listBillPayments,
  listBills,
  listDeletedBills,
  listElectricity,
  payBill as payBillFeature,
  restoreBill as restoreBillFeature,
  updateBill as updateBillFeature,
  type NewBillInput,
  type PayBillInput,
} from '../features/bills'
import { onDataChanged } from '../features/sync/events'
import type { MutationContext } from '../features/sync/context'
import type { Bill, ElectricityRecord } from '../types/models'
import { useAuth } from '../hooks/useAuth'
import { useSpace } from '../hooks/useSpace'
import { useMoney } from '../hooks/useMoney'
import { BillsContext } from './bills-context'

export const BillsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth()
  const { activeSpace, activeSpaceId } = useSpace()
  const { refresh: refreshMoney } = useMoney()

  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [bills, setBills] = useState<Bill[]>([])
  const [deletedBills, setDeletedBills] = useState<Bill[]>([])
  const [electricity, setElectricity] = useState<ElectricityRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void ensureDeviceId().then(setDeviceId).catch(() => setDeviceId(null))
  }, [])

  const canEdit = Boolean(activeSpace?.role)

  const ctx: MutationContext | null =
    activeSpaceId && user?.id && deviceId
      ? { spaceId: activeSpaceId, userId: user.id, deviceId }
      : null

  const requireCtx = (): MutationContext => {
    if (!ctx) throw new Error('No active space')
    if (!canEdit) throw new Error('You can only view this space')
    return ctx
  }

  const load = useCallback(async () => {
    if (!activeSpaceId) {
      setBills([])
      setDeletedBills([])
      setElectricity([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [b, deleted, e] = await Promise.all([
        listBills(activeSpaceId),
        listDeletedBills(activeSpaceId),
        listElectricity(activeSpaceId),
      ])
      const visibleToMe = (bill: Bill) =>
        bill.visibility !== 'PRIVATE' || bill.createdBy === user?.id
      setBills(b.filter(visibleToMe))
      setDeletedBills(deleted.filter(visibleToMe))
      setElectricity(e)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load bills')
    } finally {
      setLoading(false)
    }
  }, [activeSpaceId, user?.id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  useEffect(() => onDataChanged(() => void load()), [load])

  const value = {
    bills,
    deletedBills,
    electricity,
    loading,
    error,
    canEdit: Boolean(canEdit),
    refresh: load,
    createBill: async (input: NewBillInput) => {
      await createBillFeature(requireCtx(), input)
      await load()
    },
    updateBill: async (
      id: string,
      patch: Partial<NewBillInput> & { active?: boolean },
    ) => {
      await updateBillFeature(requireCtx(), id, patch)
      await load()
    },
    deleteBill: async (id: string) => {
      await deleteBillFeature(requireCtx(), id)
      await load()
    },
    restoreBill: async (id: string) => {
      await restoreBillFeature(requireCtx(), id)
      await load()
    },
    payBill: async (billId: string, input: PayBillInput) => {
      await payBillFeature(requireCtx(), billId, input)
      await load()
      await refreshMoney()
    },
    paymentsFor: (billId: string) => listBillPayments(billId),
    deletePayment: async (paymentId: string) => {
      await deleteBillPaymentFeature(requireCtx(), paymentId)
      await load()
      await refreshMoney()
    },
  }

  return (
    <BillsContext.Provider value={value}>{children}</BillsContext.Provider>
  )
}
