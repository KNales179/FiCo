import { getDB } from '../../db/database'
import type { StoreName } from '../../db/schema'

/** entityType (as used in sync events) → IndexedDB object store. */
const STORE_FOR: Record<string, StoreName> = {
  account: 'accounts',
  transaction: 'transactions',
  shoppingList: 'shoppingLists',
  shoppingItem: 'shoppingItems',
  itemProfile: 'itemProfiles',
  priceHistory: 'priceHistory',
  bill: 'bills',
  billPayment: 'billPayments',
  electricityRecord: 'electricityRecords',
  reconciliation: 'reconciliations',
  category: 'categories',
}

export const isApplicableEntity = (entityType: string): boolean =>
  entityType in STORE_FOR

/**
 * Write one record pulled from the server into its local store. The payload is
 * the full client record; we mark it SYNCED and stamp `deletedAt` when the
 * server says it's gone.
 */
export const applyRemoteRecord = async (
  entityType: string,
  payload: Record<string, unknown>,
  deletedAt: string | null,
): Promise<void> => {
  const store = STORE_FOR[entityType]
  if (!store) return

  const record: Record<string, unknown> = {
    ...payload,
    syncStatus: 'SYNCED',
  }
  if (deletedAt) {
    record.deletedAt = deletedAt
  }

  const db = await getDB()
  // Keyed by `id` for every applicable store.
  await db.put(store, record as never)
}

/** Is this local record still waiting to be pushed? Then don't overwrite it. */
export const isLocallyPending = async (
  entityType: string,
  id: string,
): Promise<boolean> => {
  const store = STORE_FOR[entityType]
  if (!store) return false
  const db = await getDB()
  const existing = (await db.get(store, id)) as
    | { syncStatus?: string }
    | undefined
  return existing?.syncStatus === 'PENDING'
}

/** Update a local record's sync bookkeeping once its push has been handled. */
export const markLocalSyncStatus = async (
  entityType: string,
  id: string,
  status: 'SYNCED' | 'FAILED' | 'PENDING',
): Promise<void> => {
  const store = STORE_FOR[entityType]
  if (!store) return
  const db = await getDB()
  const existing = (await db.get(store, id)) as
    | Record<string, unknown>
    | undefined
  if (!existing) return

  const current = existing.syncStatus
  // SYNCED/FAILED only apply to a record still PENDING (never stomp a fresh
  // edit). PENDING is the retry path: re-queue a FAILED record.
  const allowed =
    status === 'PENDING'
      ? current === 'FAILED'
      : current === 'PENDING'

  if (allowed) {
    await db.put(store, { ...existing, syncStatus: status } as never)
  }
}

/**
 * Stop tracking a change locally when the user discards it — clears the FAILED
 * flag so the row isn't stuck; the next pull brings the server's version.
 */
export const clearFailedFlag = async (
  entityType: string,
  id: string,
): Promise<void> => {
  const store = STORE_FOR[entityType]
  if (!store) return
  const db = await getDB()
  const existing = (await db.get(store, id)) as
    | Record<string, unknown>
    | undefined
  if (!existing || existing.syncStatus !== 'FAILED') return
  await db.put(store, { ...existing, syncStatus: 'SYNCED' } as never)
}
