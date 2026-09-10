import { describe, expect, it } from 'vitest'
import { getDB } from './database'
import { DB_VERSION } from './schema'
import { STORE_DEFINITIONS } from './migrations'

const EXPECTED_STORES = [
  'users',
  'sessions',
  'spaces',
  'memberships',
  'accounts',
  'transactions',
  'shoppingLists',
  'shoppingItems',
  'itemProfiles',
  'priceHistory',
  'bills',
  'billPayments',
  'electricityRecords',
  'attachments',
  'syncEvents',
  'reconciliations',
  'categories',
  'metadata',
]

describe('IndexedDB schema', () => {
  it('opens at DB_VERSION with every store present', async () => {
    const db = await getDB()
    expect(db.version).toBe(DB_VERSION)
    const names = [...db.objectStoreNames].sort()
    expect(names).toEqual([...EXPECTED_STORES].sort())
  })

  it('every store definition creates its declared indexes', async () => {
    const db = await getDB()
    for (const def of STORE_DEFINITIONS) {
      const tx = db.transaction(def.name, 'readonly')
      const store = tx.objectStore(def.name)
      const indexNames = store.indexNames as unknown as DOMStringList
      for (const index of def.indexes ?? []) {
        expect(indexNames.contains(index.name)).toBe(true)
      }
      await tx.done
    }
  })

  it('a fresh factory re-runs migrations from zero cleanly', async () => {
    // setup.ts swaps in a new IDBFactory per test; just prove the second open
    // in this test also lands on the full schema.
    const db = await getDB()
    expect(db.objectStoreNames.length).toBe(EXPECTED_STORES.length)
  })
})
