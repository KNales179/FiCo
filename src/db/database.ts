import { deleteDB, openDB, type IDBPDatabase } from 'idb'
import { DB_NAME, DB_VERSION, type FicoDB } from './schema'
import { runMigrations } from './migrations'

// TEMPORARY DEBUG LOG — proves which build of this module the browser is
// actually running, since a stale cache/service worker would silently keep
// serving an older DB_VERSION with no visible symptom otherwise. Remove once
// the missing-store issue is confirmed fixed.
console.log('[fico/db DEBUG] database.ts loaded, DB_VERSION =', DB_VERSION)

let dbPromise: Promise<IDBPDatabase<FicoDB>> | null = null

/**
 * Opens (once) and returns the Fico IndexedDB connection. All repositories go
 * through this so the app has a single connection with a single upgrade path.
 */
export function getDB(): Promise<IDBPDatabase<FicoDB>> {
  if (!dbPromise) {
    console.log('[fico/db DEBUG] opening database, requested version =', DB_VERSION)
    dbPromise = openDB<FicoDB>(DB_NAME, DB_VERSION, {
      async upgrade(db, oldVersion, newVersion, tx) {
        console.log(
          '[fico/db DEBUG] upgrade callback firing: oldVersion =',
          oldVersion,
          'newVersion =',
          newVersion,
          'stores before =',
          [...db.objectStoreNames],
        )
        await runMigrations(db, oldVersion, newVersion ?? DB_VERSION, tx)
        console.log(
          '[fico/db DEBUG] upgrade callback done. stores after =',
          [...db.objectStoreNames],
        )
      },
      blocked() {
        console.warn(
          '[fico/db] Upgrade blocked — another tab is holding an older version open.',
        )
      },
      blocking() {
        // A newer version wants to open elsewhere; release our connection so it
        // can proceed, and drop the cached promise so the next call reopens.
        console.warn('[fico/db] Closing connection so a newer version can upgrade.')
        void getDB().then((db) => db.close())
        dbPromise = null
      },
      terminated() {
        console.warn('[fico/db] Connection terminated unexpectedly; will reopen on next use.')
        dbPromise = null
      },
    })
    void dbPromise.then((db) => {
      console.log(
        '[fico/db DEBUG] connection ready. actual version =',
        db.version,
        'stores =',
        [...db.objectStoreNames],
      )
    })
  }

  return dbPromise
}

/** Closes the cached connection (mainly for tests and hard resets). */
export async function closeDB(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise
    db.close()
    dbPromise = null
  }
}

/**
 * Deletes the entire local database. Destructive — used only for an explicit
 * "clear local data" action or when tearing down in tests.
 */
export async function deleteDatabase(): Promise<void> {
  await closeDB()
  await deleteDB(DB_NAME)
}
