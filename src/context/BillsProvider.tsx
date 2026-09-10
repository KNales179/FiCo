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
  listBillPayments,
  listBills,
  listElectricity,
  payBill as payBillFeature,
  updateBill as updateBillFeature,
  type NewBillInput,
  type PayBillInput,
} from '../features/bills'
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
  const [electricity, setElectricity] = useState<ElectricityRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void ensureDeviceId().then(setDeviceId).catch(() => setDeviceId(null))
  }, [])

  const canEdit =
    activeSpace?.role === 'OWNER' || activeSpace?.role === 'EDITOR'

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
      setElectricity([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [b, e] = await Promise.all([
        listBills(activeSpaceId),
        listElectricity(activeSpaceId),
      ])
      setBills(b)
      setElectricity(e)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load bills')
    } finally {
      setLoading(false)
    }
  }, [activeSpaceId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const value = {
    bills,
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
    payBill: async (billId: string, input: PayBillInput) => {
      await payBillFeature(requireCtx(), billId, input)
      await load()
      await refreshMoney()
    },
    paymentsFor: (billId: string) => listBillPayments(billId),
  }

  return (
    <BillsContext.Provider value={value}>{children}</BillsContext.Provider>
  )
}
