import { metadataRepository, MetadataKeys } from '../repositories/metadataRepository'
import { getDB } from './database'
import { DB_VERSION } from './schema'

let initPromise: Promise<void> | null = null

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
      await getDB()

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
