import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import { ensureDeviceId } from '../features/auth/localAuth'
import { suggestForName } from '../features/items'
import {
  computeSpaceBalances,
  createAccount,
  deleteAccount,
  deleteTransaction,
  listTransactions,
  recordTransaction,
  resolveDefaultAccount,
  setAccountStatus,
  setDefaultAccount,
  type AccountWithBalance,
  type MoneyContext as MoneyCtx,
  type NewAccountInput,
  type RecordTransactionInput,
} from '../features/money'
import type { Transaction } from '../types/models'
import { useAuth } from '../hooks/useAuth'
import { useSpace } from '../hooks/useSpace'
import { MoneyContext } from './money-context'

const RECENT_LIMIT = 50

export const MoneyProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth()
  const { activeSpace, activeSpaceId } = useSpace()

  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([])
  const [totalsByCurrency, setTotals] = useState<Record<string, number>>({})
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void ensureDeviceId()
      .then(setDeviceId)
      .catch(() => setDeviceId(null))
  }, [])

  const canEdit =
    activeSpace?.role === 'OWNER' || activeSpace?.role === 'EDITOR'

  const ctx: MoneyCtx | null =
    activeSpaceId && user?.id && deviceId
      ? { spaceId: activeSpaceId, userId: user.id, deviceId }
      : null

  const load = useCallback(async () => {
    if (!activeSpaceId) {
      setAccounts([])
      setTotals({})
      setTransactions([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [balances, recent] = await Promise.all([
        computeSpaceBalances(activeSpaceId),
        listTransactions(activeSpaceId, { limit: RECENT_LIMIT }),
      ])
      setAccounts(balances.accounts)
      setTotals(balances.totalsByCurrency)
      setTransactions(recent)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load money data')
    } finally {
      setLoading(false)
    }
  }, [activeSpaceId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const requireCtx = (): MoneyCtx => {
    if (!ctx) throw new Error('No active space')
    if (!canEdit) throw new Error('You can only view this space')
    return ctx
  }

  const addAccount = useCallback(
    async (input: NewAccountInput) => {
      await createAccount(requireCtx(), input)
      await load()
    },
    // requireCtx closes over ctx/canEdit which change with space/user
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx, canEdit, load],
  )

  const archiveAccount = useCallback(
    async (id: string) => {
      await setAccountStatus(requireCtx(), id, 'ARCHIVED')
      await load()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx, canEdit, load],
  )

  const removeAccount = useCallback(
    async (id: string) => {
      await deleteAccount(requireCtx(), id)
      await load()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx, canEdit, load],
  )

  const makeDefaultAccount = useCallback(
    async (id: string) => {
      await setDefaultAccount(requireCtx(), id)
      await load()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx, canEdit, load],
  )

  const addTransaction = useCallback(
    async (input: RecordTransactionInput) => {
      const c = requireCtx()
      // Auto-category from a known item with the same name (§10, §38).
      let categoryName = input.categoryName ?? null
      if (!categoryName && input.type === 'EXPENSE') {
        categoryName =
          (await suggestForName(c.spaceId, input.title))?.category ?? null
      }
      await recordTransaction(c, { ...input, categoryName })
      await load()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx, canEdit, load],
  )

  const removeTransaction = useCallback(
    async (id: string) => {
      await deleteTransaction(requireCtx(), id)
      await load()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx, canEdit, load],
  )

  const defaultAccount = resolveDefaultAccount(accounts) ?? null

  return (
    <MoneyContext.Provider
      value={{
        accounts,
        totalsByCurrency,
        transactions,
        defaultAccount,
        loading,
        error,
        canEdit: Boolean(canEdit),
        refresh: load,
        addAccount,
        archiveAccount,
        removeAccount,
        makeDefaultAccount,
        addTransaction,
        removeTransaction,
      }}
    >
      {children}
    </MoneyContext.Provider>
  )
}
