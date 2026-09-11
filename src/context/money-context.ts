import { createContext } from 'react'
import type {
  Category,
  CategoryKind,
  Transaction,
} from '../types/models'
import type {
  AccountWithBalance,
  NewAccountInput,
  RecordTransactionInput,
} from '../features/money'

export interface MoneyContextValue {
  accounts: AccountWithBalance[]
  totalsByCurrency: Record<string, number>
  transactions: Transaction[]
  categories: Category[]
  /** The account Quick Add defaults to, or null when there are no accounts. */
  defaultAccount: AccountWithBalance | null
  loading: boolean
  error: string | null
  /** True when the caller may add or change money records in the active space. */
  canEdit: boolean
  refresh: () => Promise<void>
  addAccount: (
    input: NewAccountInput & { isDefault?: boolean },
  ) => Promise<void>
  archiveAccount: (id: string) => Promise<void>
  removeAccount: (id: string) => Promise<void>
  makeDefaultAccount: (id: string) => Promise<void>
  addTransaction: (input: RecordTransactionInput) => Promise<void>
  removeTransaction: (id: string) => Promise<void>
  setTransactionVisibility: (
    id: string,
    visibility: 'SPACE' | 'PRIVATE',
  ) => Promise<void>
  addCategory: (input: {
    name: string
    kind: CategoryKind
    tracksItems?: boolean
  }) => Promise<void>
  editCategory: (
    id: string,
    patch: { name?: string; archived?: boolean; tracksItems?: boolean },
  ) => Promise<void>
  removeCategory: (id: string) => Promise<void>
}

export const MoneyContext = createContext<MoneyContextValue | undefined>(
  undefined,
)
