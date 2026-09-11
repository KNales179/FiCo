import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { ensureDeviceId } from '../features/auth/localAuth'
import { onDataChanged } from '../features/sync/events'
import { suggestForName } from '../features/items'
import {
  createCategory as createCategoryFeature,
  deleteCategory as deleteCategoryFeature,
  ensureDefaultCategories,
  listCategories,
  updateCategory as updateCategoryFeature,
} from '../features/categories'
import {
  backfillOpeningBalances,
  computeSpaceBalances,
  createAccount,
  deleteAccount,
  deleteTransaction,
  listTransactions,
  recordTransaction,
  resolveDefaultAccount,
  setAccountStatus,
  setDefaultAccount,
  setTransactionVisibility,
  type AccountWithBalance,
  type MoneyContext as MoneyCtx,
  type NewAccountInput,
  type RecordTransactionInput,
} from '../features/money'
import type {
  Category,
  CategoryKind,
  Transaction,
} from '../types/models'
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
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void ensureDeviceId()
      .then(setDeviceId)
      .catch(() => setDeviceId(null))
  }, [])

  const canEdit = Boolean(activeSpace?.role)

  const ctx: MoneyCtx | null =
    activeSpaceId && user?.id && deviceId
      ? { spaceId: activeSpaceId, userId: user.id, deviceId }
      : null

  const load = useCallback(async () => {
    if (!activeSpaceId) {
      setAccounts([])
      setTotals({})
      setTransactions([])
      setCategories([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      if (ctx && canEdit) {
        await ensureDefaultCategories(ctx)
        await backfillOpeningBalances(ctx)
      }
      const [balances, recent, cats] = await Promise.all([
        computeSpaceBalances(activeSpaceId),
        listTransactions(activeSpaceId, { limit: RECENT_LIMIT }),
        listCategories(activeSpaceId),
      ])
      setAccounts(balances.accounts)
      setTotals(balances.totalsByCurrency)
      // A private record is only shown to its creator (Product Spec §22).
      setTransactions(
        recent.filter(
          (t) => t.visibility !== 'PRIVATE' || t.createdBy === user?.id,
        ),
      )
      setCategories(cats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load money data')
    } finally {
      setLoading(false)
    }
    // ctx/canEdit intentionally not deps — only used opportunistically for the seed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSpaceId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  // Coalesce bursts of mutations (e.g. completing a shopping list emits many
  // `fico:data-changed` events) into a single reload (Roadmap Phase 26).
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const unsubscribe = onDataChanged(() => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current)
      reloadTimer.current = setTimeout(() => void load(), 120)
    })
    return () => {
      unsubscribe()
      if (reloadTimer.current) clearTimeout(reloadTimer.current)
    }
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
      let categoryId = input.categoryId ?? null
      let categoryName = input.categoryName ?? null

      if (categoryId && !categoryName) {
        categoryName =
          categories.find((cat) => cat.id === categoryId)?.name ?? null
      }
      // Auto-category from a known item with the same name (§10, §38).
      if (!categoryId && !categoryName && input.type === 'EXPENSE') {
        const s = await suggestForName(c.spaceId, input.title)
        categoryId = s?.categoryId ?? null
        categoryName = s?.category ?? null
      }
      await recordTransaction(c, { ...input, categoryId, categoryName })
      await load()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx, canEdit, load, categories],
  )

  const addCategory = useCallback(
    async (input: { name: string; kind: CategoryKind }) => {
      await createCategoryFeature(requireCtx(), input)
      await load()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx, canEdit, load],
  )

  const editCategory = useCallback(
    async (id: string, patch: { name?: string; archived?: boolean }) => {
      await updateCategoryFeature(requireCtx(), id, patch)
      await load()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx, canEdit, load],
  )

  const removeCategory = useCallback(
    async (id: string) => {
      await deleteCategoryFeature(requireCtx(), id)
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

  const setVisibility = useCallback(
    async (id: string, visibility: 'SPACE' | 'PRIVATE') => {
      await setTransactionVisibility(requireCtx(), id, visibility)
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
        categories,
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
        setTransactionVisibility: setVisibility,
        addCategory,
        editCategory,
        removeCategory,
      }}
    >
      {children}
    </MoneyContext.Provider>
  )
}
