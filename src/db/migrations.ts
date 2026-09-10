import type { IDBPDatabase, IDBPTransaction } from 'idb'
import type { FicoDB, StoreName } from './schema'

/** Shape used to declaratively create a store and its indexes on upgrade. */
interface IndexDefinition {
  name: string
  keyPath: string | string[]
  options?: IDBIndexParameters
}

interface StoreDefinition {
  name: StoreName
  keyPath: string
  indexes?: IndexDefinition[]
}

/**
 * Every store Fico creates at schema version 1. This is the source of truth for
 * `createMissingStores`; `FicoDB` in `./schema.ts` is the matching type.
 *
 * The 16 stores map 1:1 to `Plan/02-Fico-System-Architecture.md` §6.
 */
export const STORE_DEFINITIONS: StoreDefinition[] = [
  {
    name: 'users',
    keyPath: 'id',
    indexes: [
      { name: 'by-username', keyPath: 'username', options: { unique: true } },
      { name: 'by-updatedAt', keyPath: 'updatedAt' },
    ],
  },
  {
    name: 'sessions',
    keyPath: 'id',
    indexes: [{ name: 'by-userId', keyPath: 'userId' }],
  },
  {
    name: 'spaces',
    keyPath: 'id',
    indexes: [
      { name: 'by-ownerId', keyPath: 'ownerId' },
      { name: 'by-updatedAt', keyPath: 'updatedAt' },
    ],
  },
  {
    name: 'memberships',
    keyPath: 'id',
    indexes: [
      { name: 'by-spaceId', keyPath: 'spaceId' },
      { name: 'by-userId', keyPath: 'userId' },
      {
        name: 'by-space-user',
        keyPath: ['spaceId', 'userId'],
        options: { unique: true },
      },
    ],
  },
  {
    name: 'accounts',
    keyPath: 'id',
    indexes: [
      { name: 'by-spaceId', keyPath: 'spaceId' },
      { name: 'by-updatedAt', keyPath: 'updatedAt' },
    ],
  },
  {
    name: 'transactions',
    keyPath: 'id',
    indexes: [
      { name: 'by-spaceId', keyPath: 'spaceId' },
      { name: 'by-accountId', keyPath: 'accountId' },
      { name: 'by-categoryId', keyPath: 'categoryId' },
      { name: 'by-occurredAt', keyPath: 'occurredAt' },
      { name: 'by-space-occurredAt', keyPath: ['spaceId', 'occurredAt'] },
      { name: 'by-source', keyPath: ['sourceType', 'sourceId'] },
      { name: 'by-syncStatus', keyPath: 'syncStatus' },
    ],
  },
  {
    name: 'shoppingLists',
    keyPath: 'id',
    indexes: [
      { name: 'by-spaceId', keyPath: 'spaceId' },
      { name: 'by-status', keyPath: 'status' },
      { name: 'by-updatedAt', keyPath: 'updatedAt' },
    ],
  },
  {
    name: 'shoppingItems',
    keyPath: 'id',
    indexes: [
      { name: 'by-shoppingListId', keyPath: 'shoppingListId' },
      { name: 'by-itemProfileId', keyPath: 'itemProfileId' },
    ],
  },
  {
    name: 'itemProfiles',
    keyPath: 'id',
    indexes: [
      { name: 'by-spaceId', keyPath: 'spaceId' },
      { name: 'by-normalizedName', keyPath: 'normalizedName' },
      {
        name: 'by-space-normalizedName',
        keyPath: ['spaceId', 'normalizedName'],
        options: { unique: true },
      },
    ],
  },
  {
    name: 'priceHistory',
    keyPath: 'id',
    indexes: [
      { name: 'by-itemProfileId', keyPath: 'itemProfileId' },
      { name: 'by-purchasedAt', keyPath: 'purchasedAt' },
    ],
  },
  {
    name: 'bills',
    keyPath: 'id',
    indexes: [
      { name: 'by-spaceId', keyPath: 'spaceId' },
      { name: 'by-nextDueDate', keyPath: 'nextDueDate' },
    ],
  },
  {
    name: 'billPayments',
    keyPath: 'id',
    indexes: [
      { name: 'by-billId', keyPath: 'billId' },
      { name: 'by-paidAt', keyPath: 'paidAt' },
    ],
  },
  {
    name: 'electricityRecords',
    keyPath: 'id',
    indexes: [
      { name: 'by-billPaymentId', keyPath: 'billPaymentId' },
      { name: 'by-billingPeriod', keyPath: 'billingPeriod' },
    ],
  },
  {
    name: 'attachments',
    keyPath: 'id',
    indexes: [
      { name: 'by-entity', keyPath: ['entityType', 'entityId'] },
      { name: 'by-spaceId', keyPath: 'spaceId' },
      { name: 'by-syncStatus', keyPath: 'syncStatus' },
    ],
  },
  {
    name: 'syncEvents',
    keyPath: 'id',
    indexes: [
      { name: 'by-status', keyPath: 'status' },
      { name: 'by-createdAt', keyPath: 'createdAt' },
      { name: 'by-entity', keyPath: ['entityType', 'entityId'] },
    ],
  },
  {
    name: 'reconciliations',
    keyPath: 'id',
    indexes: [
      { name: 'by-spaceId', keyPath: 'spaceId' },
      { name: 'by-accountId', keyPath: 'accountId' },
      { name: 'by-status', keyPath: 'status' },
    ],
  },
  {
    name: 'categories',
    keyPath: 'id',
    indexes: [
      { name: 'by-spaceId', keyPath: 'spaceId' },
      { name: 'by-space-kind', keyPath: ['spaceId', 'kind'] },
    ],
  },
  {
    name: 'metadata',
    keyPath: 'key',
  },
]

type UpgradeDB = IDBPDatabase<FicoDB>
type UpgradeTx = IDBPTransaction<FicoDB, StoreName[], 'versionchange'>

/**
 * Creates any store/index from `STORE_DEFINITIONS` that does not yet exist.
 * Safe to run on every upgrade — it only adds what is missing, so bringing a
 * fresh database from 0 → current and an older one from N → current both work.
 */
function createMissingStores(db: UpgradeDB, tx: UpgradeTx): void {
  for (const definition of STORE_DEFINITIONS) {
    // Schema-only operations: work through the raw IDB types so the declarative
    // loop isn't fighting idb's per-store generics.
    const store = (
      db.objectStoreNames.contains(definition.name)
        ? tx.objectStore(definition.name)
        : db.createObjectStore(definition.name, {
            keyPath: definition.keyPath,
          })
    ) as unknown as IDBObjectStore

    for (const index of definition.indexes ?? []) {
      if (!store.indexNames.contains(index.name)) {
        store.createIndex(index.name, index.keyPath, index.options)
      }
    }
  }
}

/**
 * Ordered migrations. Index `i` is the step applied when upgrading *to*
 * version `i + 1`. Append new steps; never edit or reorder existing ones.
 */
export const migrations: Array<
  (db: UpgradeDB, tx: UpgradeTx) => void | Promise<void>
> = [
  // v1 — initial schema: the first 16 stores.
  (db, tx) => {
    createMissingStores(db, tx)
  },
  // v2 — add `reconciliations` (Phase 14). createMissingStores only adds what
  // is absent, so this is safe for both fresh and existing databases.
  (db, tx) => {
    createMissingStores(db, tx)
  },
  // v3 — add `categories` (managed category list).
  (db, tx) => {
    createMissingStores(db, tx)
  },
]

/**
 * Runs every migration between `oldVersion` and `newVersion`. Called from the
 * `upgrade` handler in `./database.ts`.
 */
export async function runMigrations(
  db: UpgradeDB,
  oldVersion: number,
  newVersion: number,
  tx: UpgradeTx,
): Promise<void> {
  for (let version = oldVersion; version < newVersion; version += 1) {
    const migrate = migrations[version]
    if (migrate) {
      await migrate(db, tx)
    }
  }
}
