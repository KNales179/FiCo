import { getDB } from '../db/database'
import type {
  SyncEvent,
  SyncEventStatus,
  SyncOperation,
} from '../types/models'

export type NewSyncEvent = Omit<
  SyncEvent,
  'id' | 'status' | 'retryCount' | 'lastError' | 'createdAt' | 'updatedAt'
> & { operation: SyncOperation }

/**
 * The outbound queue of local mutations awaiting the backend. Sync is
 * event-based, not whole-record replacement, so independent offline changes
 * can be merged (Architecture §34–§35). Every event carries a stable id for
 * idempotent processing on the server (Architecture §38).
 */
export const syncEventRepository = {
  /** Add a mutation to the outbound queue. */
  async enqueue(event: NewSyncEvent): Promise<SyncEvent> {
    const db = await getDB()
    const timestamp = new Date().toISOString()
    const record: SyncEvent = {
      ...event,
      id: crypto.randomUUID(),
      status: 'PENDING',
      retryCount: 0,
      lastError: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    await db.add('syncEvents', record)
    return record
  },

  async get(id: string): Promise<SyncEvent | undefined> {
    const db = await getDB()
    return db.get('syncEvents', id)
  },

  /** Pending events, oldest first — the order they should be sent. */
  async listPending(limit?: number): Promise<SyncEvent[]> {
    const db = await getDB()
    const pending = await db.getAllFromIndex(
      'syncEvents',
      'by-status',
      'PENDING',
    )
    pending.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return limit ? pending.slice(0, limit) : pending
  },

  async listByStatus(status: SyncEventStatus): Promise<SyncEvent[]> {
    const db = await getDB()
    return db.getAllFromIndex('syncEvents', 'by-status', status)
  },

  async listForEntity(
    entityType: string,
    entityId: string,
  ): Promise<SyncEvent[]> {
    const db = await getDB()
    return db.getAllFromIndex('syncEvents', 'by-entity', [
      entityType,
      entityId,
    ])
  },

  async countPending(): Promise<number> {
    const db = await getDB()
    return db.countFromIndex('syncEvents', 'by-status', 'PENDING')
  },

  async setStatus(
    id: string,
    status: SyncEventStatus,
    lastError?: string | null,
  ): Promise<void> {
    const db = await getDB()
    const tx = db.transaction('syncEvents', 'readwrite')
    const existing = await tx.store.get(id)
    if (existing) {
      existing.status = status
      existing.updatedAt = new Date().toISOString()
      if (lastError !== undefined) {
        existing.lastError = lastError
      }
      if (status === 'FAILED') {
        existing.retryCount += 1
      }
      await tx.store.put(existing)
    }
    await tx.done
  },

  async remove(id: string): Promise<void> {
    const db = await getDB()
    await db.delete('syncEvents', id)
  },

  /** Drop events already confirmed by the server. */
  async purgeSynced(): Promise<number> {
    const db = await getDB()
    const tx = db.transaction('syncEvents', 'readwrite')
    const index = tx.store.index('by-status')
    let removed = 0
    for await (const cursor of index.iterate('SYNCED')) {
      await cursor.delete()
      removed += 1
    }
    await tx.done
    return removed
  },
}
