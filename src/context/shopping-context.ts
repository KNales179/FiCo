import { createContext } from 'react'
import type { ShoppingItem, ShoppingList } from '../types/models'
import type { NewItemInput, NewListInput } from '../features/shopping'
import type { CompletionResult } from '../features/shopping/complete'

export interface ShoppingContextValue {
  lists: ShoppingList[]
  selectedList: ShoppingList | null
  items: ShoppingItem[]
  loading: boolean
  error: string | null
  canEdit: boolean
  selectList: (id: string | null) => void
  refresh: () => Promise<void>
  createList: (input: NewListInput) => Promise<ShoppingList>
  updateList: (
    id: string,
    patch: Partial<
      Pick<
        ShoppingList,
        'title' | 'plannedBudgetMinor' | 'status' | 'visibility'
      >
    >,
  ) => Promise<void>
  cancelList: (id: string) => Promise<void>
  completeList: (id: string, accountId?: string) => Promise<CompletionResult>
  deleteList: (id: string) => Promise<void>
  addItem: (input: NewItemInput) => Promise<void>
  renameItem: (id: string, name: string) => Promise<void>
  setPlannedPrice: (id: string, minor: number | null) => Promise<void>
  setActualPrice: (id: string, minor: number | null) => Promise<void>
  toggleItem: (id: string, checked: boolean) => Promise<void>
  removeItem: (id: string) => Promise<void>
  setItemCategory: (
    itemName: string,
    categoryId: string | null,
  ) => Promise<void>
}

export const ShoppingContext = createContext<
  ShoppingContextValue | undefined
>(undefined)
