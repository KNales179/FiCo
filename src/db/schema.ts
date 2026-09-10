import type { DBSchema, StoreNames } from 'idb'
import type {
  Account,
  Attachment,
  Bill,
  BillPayment,
  ElectricityRecord,
  ItemProfile,
  LocalSession,
  LocalUser,
  Membership,
  MetadataEntry,
  PriceHistory,
  Reconciliation,
  ShoppingItem,
  ShoppingList,
  Space,
  SyncEvent,
  Transaction,
} from '../types/models'

export const DB_NAME = 'fico'

/**
 * Bump this whenever the store/index layout changes, and add a matching entry
 * to `migrations` in `./migrations.ts`. Never mutate an existing migration —
 * append a new one.
 *
 * v1 — initial 16 stores
 * v2 — + `reconciliations` (Phase 14)
 */
export const DB_VERSION = 2

/**
 * Typed description of every object store and its indexes, consumed by `idb`.
 * The string literals here must stay in sync with `STORE_DEFINITIONS` in
 * `./migrations.ts`, which is what actually creates the stores on upgrade.
 */
export interface FicoDB extends DBSchema {
  users: {
    key: string
    value: LocalUser
    indexes: {
      'by-username': string
      'by-updatedAt': string
    }
  }
  sessions: {
    key: string
    value: LocalSession
    indexes: {
      'by-userId': string
    }
  }
  spaces: {
    key: string
    value: Space
    indexes: {
      'by-ownerId': string
      'by-updatedAt': string
    }
  }
  memberships: {
    key: string
    value: Membership
    indexes: {
      'by-spaceId': string
      'by-userId': string
      'by-space-user': [string, string]
    }
  }
  accounts: {
    key: string
    value: Account
    indexes: {
      'by-spaceId': string
      'by-updatedAt': string
    }
  }
  transactions: {
    key: string
    value: Transaction
    indexes: {
      'by-spaceId': string
      'by-accountId': string
      'by-categoryId': string
      'by-occurredAt': string
      'by-space-occurredAt': [string, string]
      'by-source': [string, string]
      'by-syncStatus': string
    }
  }
  shoppingLists: {
    key: string
    value: ShoppingList
    indexes: {
      'by-spaceId': string
      'by-status': string
      'by-updatedAt': string
    }
  }
  shoppingItems: {
    key: string
    value: ShoppingItem
    indexes: {
      'by-shoppingListId': string
      'by-itemProfileId': string
    }
  }
  itemProfiles: {
    key: string
    value: ItemProfile
    indexes: {
      'by-spaceId': string
      'by-normalizedName': string
      'by-space-normalizedName': [string, string]
    }
  }
  priceHistory: {
    key: string
    value: PriceHistory
    indexes: {
      'by-itemProfileId': string
      'by-purchasedAt': string
    }
  }
  bills: {
    key: string
    value: Bill
    indexes: {
      'by-spaceId': string
      'by-nextDueDate': string
    }
  }
  billPayments: {
    key: string
    value: BillPayment
    indexes: {
      'by-billId': string
      'by-paidAt': string
    }
  }
  electricityRecords: {
    key: string
    value: ElectricityRecord
    indexes: {
      'by-billPaymentId': string
      'by-billingPeriod': string
    }
  }
  attachments: {
    key: string
    value: Attachment
    indexes: {
      'by-entity': [string, string]
      'by-spaceId': string
      'by-syncStatus': string
    }
  }
  syncEvents: {
    key: string
    value: SyncEvent
    indexes: {
      'by-status': string
      'by-createdAt': string
      'by-entity': [string, string]
    }
  }
  reconciliations: {
    key: string
    value: Reconciliation
    indexes: {
      'by-spaceId': string
      'by-accountId': string
      'by-status': string
    }
  }
  metadata: {
    key: string
    value: MetadataEntry
  }
}

export type StoreName = StoreNames<FicoDB>
