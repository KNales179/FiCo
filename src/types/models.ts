/**
 * Local data model for Fico's IndexedDB layer.
 *
 * These mirror the server-side entities described in
 * `Plan/02-Fico-System-Architecture.md` (sections 8–40). The client store is
 * not a byte-for-byte copy of MongoDB — notably it never holds a password hash
 * (Architecture Rule 8) — but ids and shapes are kept compatible so records can
 * be synchronized without translation.
 *
 * Conventions:
 * - `id` is a client-generated UUID (`crypto.randomUUID()`).
 * - Timestamps are ISO 8601 strings (sortable, index-friendly, Mongo-friendly).
 * - Money is always integer minor units (centavos) plus an ISO currency code
 *   (Architecture Rule 14). Never a float.
 * - `deletedAt` present + non-null means the record is soft-deleted
 *   (Architecture §50).
 */

/** Fields shared by every synchronizable record. */
export interface BaseEntity {
  id: string
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

/** Per-record synchronization bookkeeping, filled in by the sync engine (Phase 18). */
export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED'

export interface SyncableEntity extends BaseEntity {
  /** Local sync state. New local records start as `PENDING`. */
  syncStatus: SyncStatus
  /** Monotonic version used for conflict detection (Architecture §39). */
  version: number
}

// ---------------------------------------------------------------------------
// Identity & spaces
// ---------------------------------------------------------------------------

export type UserStatus = 'ACTIVE' | 'DISABLED'

/**
 * A cached view of a Fico account — the signed-in user and any collaborators
 * seen through shared spaces. Never contains credentials.
 */
export interface LocalUser extends BaseEntity {
  username: string
  email?: string
  displayName?: string
  status: UserStatus
}

/**
 * Local record of the authenticated session on this device. Used so a
 * previously authenticated device can open Fico offline (Architecture §42).
 * The actual session token lives in an httpOnly cookie, never here.
 */
export interface LocalSession {
  id: string
  userId: string
  deviceId: string
  authenticatedAt: string
  expiresAt: string
  lastValidatedAt: string
  revokedAt?: string | null
}

export type SpaceType = 'PERSONAL' | 'FAMILY'

export interface Space extends SyncableEntity {
  name: string
  type: SpaceType
  ownerId: string
}

export type MembershipRole = 'OWNER' | 'EDITOR' | 'VIEWER'
export type MembershipStatus = 'ACTIVE' | 'INVITED' | 'REVOKED'

export interface Membership extends SyncableEntity {
  spaceId: string
  userId: string
  role: MembershipRole
  status: MembershipStatus
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

export type AccountType =
  | 'CASH'
  | 'BANK'
  | 'EWALLET'
  | 'SAVINGS'
  | 'OTHER'

export type AccountStatus = 'ACTIVE' | 'ARCHIVED'

export interface Account extends SyncableEntity {
  spaceId: string
  name: string
  type: AccountType
  currency: string
  openingBalanceMinor: number
  status: AccountStatus
}

export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER'

/** What produced this transaction, when it wasn't entered directly. */
export type TransactionSourceType =
  | 'MANUAL'
  | 'SHOPPING_ITEM'
  | 'SHOPPING_LIST'
  | 'BILL_PAYMENT'

export interface Transaction extends SyncableEntity {
  spaceId: string
  type: TransactionType
  amountMinor: number
  currency: string
  title: string
  details?: string
  categoryId?: string | null
  /** Source account. For a TRANSFER this is where money leaves. */
  accountId: string
  /** Destination account — only for TRANSFER. */
  destinationAccountId?: string | null
  occurredAt: string
  sourceType: TransactionSourceType
  sourceId?: string | null
  createdBy: string
}

export type CategoryType = 'INCOME' | 'EXPENSE'

export interface Category extends SyncableEntity {
  spaceId: string
  name: string
  type: CategoryType
}

// ---------------------------------------------------------------------------
// Shopping
// ---------------------------------------------------------------------------

export type ShoppingListStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

export interface ShoppingList extends SyncableEntity {
  spaceId: string
  title: string
  status: ShoppingListStatus
  plannedAt?: string | null
  completedAt?: string | null
  createdBy: string
}

export interface ShoppingItem extends SyncableEntity {
  shoppingListId: string
  itemProfileId?: string | null
  name: string
  plannedPriceMinor?: number | null
  actualPriceMinor?: number | null
  quantity: number
  checked: boolean
  purchased: boolean
  /** True when the item was added while offline (Architecture §21). */
  addedOffline: boolean
  /** Expense transaction generated when the item was purchased. */
  transactionId?: string | null
  createdBy: string
}

export interface ItemProfile extends SyncableEntity {
  spaceId: string
  normalizedName: string
  displayName: string
  categoryId?: string | null
}

export interface PriceHistory extends BaseEntity {
  itemProfileId: string
  amountMinor: number
  purchasedAt: string
  transactionId?: string | null
}

// ---------------------------------------------------------------------------
// Bills
// ---------------------------------------------------------------------------

export type BillRecurrence = 'MONTHLY' | 'YEARLY'
export type BillType = 'FIXED' | 'VARIABLE'

export interface Bill extends SyncableEntity {
  spaceId: string
  name: string
  recurrence: BillRecurrence
  billType: BillType
  expectedAmountMinor?: number | null
  nextDueDate: string
  categoryId?: string | null
  paymentAccountId?: string | null
  active: boolean
}

export interface BillPayment extends SyncableEntity {
  billId: string
  amountMinor: number
  paidAt: string
  accountId: string
  transactionId?: string | null
}

export interface ElectricityRecord extends SyncableEntity {
  billPaymentId: string
  billingPeriod: string
  amountMinor: number
  consumptionKwh?: number | null
  energyChargeMinor?: number | null
  transmissionMinor?: number | null
  distributionMinor?: number | null
  taxesMinor?: number | null
  otherChargesMinor?: number | null
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export type AttachmentEntityType =
  | 'TRANSACTION'
  | 'SHOPPING_ITEM'
  | 'BILL_PAYMENT'
  | 'ELECTRICITY_RECORD'

/** Local file lifecycle (Architecture §28). */
export type AttachmentLocalStatus = 'STORED' | 'MISSING'

export interface Attachment extends BaseEntity {
  ownerId: string
  spaceId: string
  entityType: AttachmentEntityType
  entityId: string
  fileName: string
  mimeType: string
  size: number
  /** Server object-storage key, once uploaded. */
  storageKey?: string | null
  localStatus: AttachmentLocalStatus
  syncStatus: SyncStatus
  /** The bytes, held locally until uploaded. */
  blob?: Blob
  createdBy: string
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

export type SyncOperation =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'CHECK'
  | 'UNCHECK'
  | 'PAY'
  | 'SHARE'
  | 'UNSHARE'

export type SyncEventStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED'

/**
 * One local mutation, queued for the backend. Sync is event-based rather than
 * whole-record replacement so independent offline changes can be merged
 * (Architecture §34–§35).
 */
export interface SyncEvent {
  id: string
  deviceId: string
  userId: string
  spaceId?: string | null
  entityType: string
  entityId: string
  operation: SyncOperation
  payload: unknown
  clientVersion: number
  status: SyncEventStatus
  retryCount: number
  lastError?: string | null
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

/** Simple key/value store for app-level bookkeeping (schema version, last sync, deviceId, …). */
export interface MetadataEntry {
  key: string
  value: unknown
  updatedAt: string
}
