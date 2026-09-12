import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import { ensureDeviceId } from '../features/auth/localAuth'
import {
  addItem,
  cancelShoppingList,
  completeListWithExpenses,
  createShoppingList,
  deleteShoppingList,
  listItems,
  listShoppingLists,
  removeItem,
  setItemChecked,
  updateItem,
  updateShoppingList,
  type NewItemInput,
  type NewListInput,
} from '../features/shopping'
import { setItemNameCategory } from '../features/items'
import { onDataChanged } from '../features/sync/events'
import type { MutationContext } from '../features/sync/context'
import type { ShoppingItem, ShoppingList } from '../types/models'
import { useAuth } from '../hooks/useAuth'
import { useSpace } from '../hooks/useSpace'
import { useMoney } from '../hooks/useMoney'
import { ShoppingContext } from './shopping-context'

export const ShoppingProvider = ({
  children,
}: {
  children: ReactNode
}) => {
  const { user } = useAuth()
  const { activeSpace, activeSpaceId } = useSpace()
  const { defaultAccount, refresh: refreshMoney } = useMoney()

  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [lists, setLists] = useState<ShoppingList[]>([])
  const [selectedListId, setSelectedListId] = useState<string | null>(
    null,
  )
  const [items, setItems] = useState<ShoppingItem[]>([])
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

  const loadItemsFor = useCallback(async (listId: string | null) => {
    setItems(listId ? await listItems(listId) : [])
  }, [])

  // Silent by default — see the matching note in MoneyProvider. Only the
  // mount effect below passes `{ initial: true }`; every other refresh
  // (after a save, another device's change arriving via sync) updates
  // the already-rendered lists in place instead of tearing the page down.
  const load = useCallback(async (options: { initial?: boolean } = {}) => {
    if (!activeSpaceId) {
      setLists([])
      setItems([])
      setSelectedListId(null)
      setLoading(false)
      return
    }
    if (options.initial) setLoading(true)
    setError(null)
    try {
      const all = await listShoppingLists(activeSpaceId)
      const next = all.filter(
        (l) => l.visibility !== 'PRIVATE' || l.createdBy === user?.id,
      )
      setLists(next)
      setSelectedListId((current) => {
        if (current && next.some((l) => l.id === current)) return current
        const active = next.find((l) => l.status === 'ACTIVE')
        return active?.id ?? next[0]?.id ?? null
      })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load shopping lists',
      )
    } finally {
      setLoading(false)
    }
  }, [activeSpaceId, user?.id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load({ initial: true })
  }, [load])

  useEffect(
    () =>
      onDataChanged(() => {
        void load()
        void loadItemsFor(selectedListId)
      }),
    [load, loadItemsFor, selectedListId],
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadItemsFor(selectedListId)
  }, [selectedListId, loadItemsFor])

  const reload = useCallback(async () => {
    await load()
    await loadItemsFor(selectedListId)
  }, [load, loadItemsFor, selectedListId])

  const selectList = useCallback((id: string | null) => {
    setSelectedListId(id)
  }, [])

  const wrap =
    <A extends unknown[]>(fn: (c: MutationContext, ...a: A) => Promise<unknown>) =>
    async (...args: A) => {
      await fn(requireCtx(), ...args)
      await reload()
    }

  const value = {
    lists,
    selectedList: lists.find((l) => l.id === selectedListId) ?? null,
    items,
    loading,
    error,
    canEdit: Boolean(canEdit),
    selectList,
    refresh: reload,
    createList: async (input: NewListInput) => {
      const list = await createShoppingList(requireCtx(), input)
      await reload()
      setSelectedListId(list.id)
      return list
    },
    updateList: wrap(updateShoppingList),
    cancelList: wrap(cancelShoppingList),
    completeList: async (
      id: string,
      accountId?: string,
      category?: { categoryId: string | null; categoryName: string | null },
    ) => {
      const payFrom = accountId ?? defaultAccount?.id
      if (!payFrom) {
        throw new Error('Add an account to pay from first')
      }
      const result = await completeListWithExpenses(
        requireCtx(),
        id,
        payFrom,
        category,
      )
      await reload()
      await refreshMoney()
      return result
    },
    deleteList: wrap(deleteShoppingList),
    addItem: async (input: NewItemInput) => {
      if (!selectedListId) throw new Error('Select a list first')
      await addItem(requireCtx(), selectedListId, input)
      await reload()
    },
    renameItem: (id: string, name: string) =>
      wrap(updateItem)(id, { name }),
    setPlannedPrice: (id: string, minor: number | null) =>
      wrap(updateItem)(id, { plannedPriceMinor: minor }),
    setActualPrice: (id: string, minor: number | null) =>
      wrap(updateItem)(id, { actualPriceMinor: minor }),
    toggleItem: wrap(setItemChecked),
    removeItem: wrap(removeItem),
    setItemCategory: async (
      itemName: string,
      categoryId: string | null,
    ) => {
      await setItemNameCategory(requireCtx(), itemName, categoryId)
      await reload()
    },
  }

  return (
    <ShoppingContext.Provider value={value}>
      {children}
    </ShoppingContext.Provider>
  )
}
