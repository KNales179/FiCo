import { metadataRepository, MetadataKeys } from '../repositories/metadataRepository'
import { getDB } from './database'
import { DB_VERSION } from './schema'
import { STORE_DEFINITIONS } from './migrations'

let initPromise: Promise<void> | null = null

/**
 * A version bump normally guarantees every store in `STORE_DEFINITIONS`
 * exists — but at least one browser was seen completing an upgrade
 * (version bumped) without actually creating the new store, which then has
 * no way to be created until the *next* version bump. This can't repair
 * itself (IndexedDB only runs `upgrade()` on a real version increase), but
 * logging it clearly beats the cryptic native "object store was not found"
 * exception whatever code eventually hits the missing store.
 */
const checkStoresPresent = (db: { objectStoreNames: DOMStringList }): void => {
  const missing = STORE_DEFINITIONS.filter(
    (def) => !db.objectStoreNames.contains(def.name),
  ).map((def) => def.name)
  if (missing.length > 0) {
    console.error(
      `[fico/db] Missing object store(s) at version ${DB_VERSION}: ${missing.join(', ')}. ` +
        'A future app update will bump the version again to backfill this automatically.',
    )
  }
}

/**
 * Opens the database (running any pending migrations) and ensures the baseline
 * metadata every session relies on:
 *
 * - a stable `deviceId` for this browser profile (used by sync events, §34)
 * - the schema version the data was last written with
 *
 * Idempotent and safe to call from app startup on every load.
 */
export function initDB(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const db = await getDB()
      checkStoresPresent(db)

      const existingDeviceId = await metadataRepository.get<string>(
        MetadataKeys.deviceId,
      )
      if (!existingDeviceId) {
        await metadataRepository.set(
          MetadataKeys.deviceId,
          crypto.randomUUID(),
        )
      }

      await metadataRepository.set('schema.version', DB_VERSION)
    })()
  }

  return initPromise
}

/**
 * Test-only: drop the cached init promise so the next `initDB()` re-runs
 * against a fresh `IDBFactory`. Never called in the app.
 */
export function __resetInitDBForTests(): void {
  initPromise = null
}

/** The stable id for this browser profile. Call after `initDB()`. */
export async function getDeviceId(): Promise<string> {
  const deviceId = await metadataRepository.get<string>(
    MetadataKeys.deviceId,
  )
  if (!deviceId) {
    throw new Error('initDB() must run before getDeviceId()')
  }
  return deviceId
}
