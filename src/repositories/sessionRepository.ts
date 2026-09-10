import { getDB } from '../db/database'
import type { LocalSession } from '../types/models'

/**
 * The local record of this device's authenticated session. It lets a
 * previously authenticated device open Fico offline (Architecture §42). The
 * session token itself stays in an httpOnly cookie and is never stored here.
 */
export const sessionRepository = {
  async get(id: string): Promise<LocalSession | undefined> {
    const db = await getDB()
    return db.get('sessions', id)
  },

  async getForUser(userId: string): Promise<LocalSession | undefined> {
    const db = await getDB()
    return db.getFromIndex('sessions', 'by-userId', userId)
  },

  /** The current (most recently validated, non-revoked, unexpired) session. */
  async getCurrent(): Promise<LocalSession | undefined> {
    const db = await getDB()
    const all = await db.getAll('sessions')
    const now = Date.now()

    return all
      .filter(
        (session) =>
          !session.revokedAt &&
          new Date(session.expiresAt).getTime() > now,
      )
      .sort(
        (a, b) =>
          new Date(b.lastValidatedAt).getTime() -
          new Date(a.lastValidatedAt).getTime(),
      )[0]
  },

  async save(session: LocalSession): Promise<void> {
    const db = await getDB()
    await db.put('sessions', session)
  },

  async markValidated(id: string): Promise<void> {
    const db = await getDB()
    const tx = db.transaction('sessions', 'readwrite')
    const existing = await tx.store.get(id)
    if (existing) {
      existing.lastValidatedAt = new Date().toISOString()
      await tx.store.put(existing)
    }
    await tx.done
  },

  async revoke(id: string): Promise<void> {
    const db = await getDB()
    const tx = db.transaction('sessions', 'readwrite')
    const existing = await tx.store.get(id)
    if (existing) {
      existing.revokedAt = new Date().toISOString()
      await tx.store.put(existing)
    }
    await tx.done
  },

  async clear(): Promise<void> {
    const db = await getDB()
    await db.clear('sessions')
  },
}
