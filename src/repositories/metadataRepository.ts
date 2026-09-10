import { getDB } from '../db/database'
import type { MetadataEntry } from '../types/models'

/**
 * Key/value bookkeeping store: schema version, this device's id, last sync
 * time, active space, and similar app-level state that is not a domain entity.
 */
export const metadataRepository = {
  async get<T = unknown>(key: string): Promise<T | undefined> {
    const db = await getDB()
    const entry = await db.get('metadata', key)
    return entry?.value as T | undefined
  },

  async getEntry(key: string): Promise<MetadataEntry | undefined> {
    const db = await getDB()
    return db.get('metadata', key)
  },

  async set(key: string, value: unknown): Promise<void> {
    const db = await getDB()
    await db.put('metadata', {
      key,
      value,
      updatedAt: new Date().toISOString(),
    })
  },

  async remove(key: string): Promise<void> {
    const db = await getDB()
    await db.delete('metadata', key)
  },

  async all(): Promise<MetadataEntry[]> {
    const db = await getDB()
    return db.getAll('metadata')
  },
}

/** Well-known metadata keys. */
export const MetadataKeys = {
  deviceId: 'device.id',
  activeSpaceId: 'space.active',
  lastSyncAt: 'sync.lastAt',
  authUserId: 'auth.userId',
} as const
