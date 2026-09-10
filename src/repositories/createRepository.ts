import type {
  IndexKey,
  IndexNames,
  StoreKey,
  StoreValue,
} from 'idb'
import { getDB } from '../db/database'
import type { FicoDB, StoreName } from '../db/schema'
import type { BaseEntity } from '../types/models'

/** Store names whose value type is a soft-deletable entity with id + timestamps. */
type EntityStoreName = {
  [K in StoreName]: StoreValue<FicoDB, K> extends BaseEntity ? K : never
}[StoreName]

/**
 * Stores served by the generic repository. `syncEvents` is excluded — its
 * queue lifecycle is handled by a dedicated repository.
 */
export type RepoStoreName = Exclude<EntityStoreName, 'syncEvents'>

export interface QueryOptions {
  /** Include soft-deleted rows (default: false). */
  includeDeleted?: boolean
}

/** Input to `create`: the record without the fields the repository manages. */
export type NewRecordInput<T extends BaseEntity> = Omit<
  T,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
> & { id?: string }

const nowIso = () => new Date().toISOString()

/**
 * Builds a typed CRUD repository over one IndexedDB object store.
 *
 * Every store is reached through here so the app has one connection, one
 * soft-delete convention, and one place that stamps `createdAt` / `updatedAt`
 * (Architecture §56, §50, §5.4).
 */
export function createRepository<K extends RepoStoreName>(storeName: K) {
  type T = StoreValue<FicoDB, K> & BaseEntity
  type Key = StoreKey<FicoDB, K>

  /** Cast helper: idb returns the store's declared value type; our repos work
   *  with that value guaranteed to also satisfy `BaseEntity`. */
  const asEntity = (value: unknown) => value as T | undefined
  const asEntities = (value: unknown[]) => value as T[]
  const asStoreValue = (value: T) => value as unknown as StoreValue<FicoDB, K>

  async function get(id: string): Promise<T | undefined> {
    const db = await getDB()
    return asEntity(await db.get(storeName, id as Key))
  }

  async function getAll(options: QueryOptions = {}): Promise<T[]> {
    const db = await getDB()
    const rows = asEntities(await db.getAll(storeName))
    return options.includeDeleted
      ? rows
      : rows.filter((row) => !row.deletedAt)
  }

  async function count(): Promise<number> {
    const db = await getDB()
    return db.count(storeName)
  }

  async function create(input: NewRecordInput<T>): Promise<T> {
    const db = await getDB()
    const timestamp = nowIso()
    const record = {
      ...input,
      id: input.id ?? crypto.randomUUID(),
      createdAt: timestamp,
      updatedAt: timestamp,
    } as unknown as T
    await db.add(storeName, asStoreValue(record))
    return record
  }

  /** Full replace. Bumps `updatedAt`. */
  async function put(record: T): Promise<T> {
    const db = await getDB()
    const next = { ...record, updatedAt: nowIso() } as T
    await db.put(storeName, asStoreValue(next))
    return next
  }

  /** Merge `patch` into an existing record. Throws if it does not exist. */
  async function update(
    id: string,
    patch: Partial<Omit<T, 'id' | 'createdAt'>>,
  ): Promise<T> {
    const db = await getDB()
    const tx = db.transaction(storeName, 'readwrite')
    const existing = asEntity(await tx.store.get(id as Key))

    if (!existing) {
      await tx.done
      throw new Error(`${storeName}: no record with id "${id}"`)
    }

    const next = {
      ...existing,
      ...patch,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: nowIso(),
    } as T

    await tx.store.put(asStoreValue(next))
    await tx.done
    return next
  }

  /** Soft delete — sets `deletedAt` so the row can still sync and be recovered. */
  async function softDelete(id: string): Promise<void> {
    await update(id, {
      deletedAt: nowIso(),
    } as Partial<Omit<T, 'id' | 'createdAt'>>)
  }

  async function restore(id: string): Promise<void> {
    await update(id, {
      deletedAt: null,
    } as Partial<Omit<T, 'id' | 'createdAt'>>)
  }

  /** Permanent removal. Prefer `softDelete` for anything financial. */
  async function hardDelete(id: string): Promise<void> {
    const db = await getDB()
    await db.delete(storeName, id as Key)
  }

  /** Replace many records in a single transaction (used by sync download). */
  async function bulkPut(records: T[]): Promise<void> {
    const db = await getDB()
    const tx = db.transaction(storeName, 'readwrite')
    await Promise.all([
      ...records.map((record) => tx.store.put(asStoreValue(record))),
      tx.done,
    ])
  }

  async function getAllByIndex<I extends IndexNames<FicoDB, K>>(
    indexName: I,
    query?: IndexKey<FicoDB, K, I> | IDBKeyRange | null,
    options: QueryOptions = {},
  ): Promise<T[]> {
    const db = await getDB()
    const rows = asEntities(
      await db.getAllFromIndex(storeName, indexName, query ?? undefined),
    )
    return options.includeDeleted
      ? rows
      : rows.filter((row) => !row.deletedAt)
  }

  async function getByIndex<I extends IndexNames<FicoDB, K>>(
    indexName: I,
    query: IndexKey<FicoDB, K, I> | IDBKeyRange,
  ): Promise<T | undefined> {
    const db = await getDB()
    return asEntity(await db.getFromIndex(storeName, indexName, query))
  }

  return {
    storeName,
    get,
    getAll,
    count,
    create,
    put,
    update,
    softDelete,
    restore,
    hardDelete,
    bulkPut,
    getAllByIndex,
    getByIndex,
  }
}

export type Repository<K extends RepoStoreName> = ReturnType<
  typeof createRepository<K>
>
