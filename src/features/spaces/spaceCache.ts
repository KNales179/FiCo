import { initDB } from '../../db/bootstrap'
import {
  membershipRepository,
  spaceRepository,
} from '../../repositories'
import type { SpaceSummary } from '../../types/space'

/**
 * Mirrors the authoritative space list into IndexedDB so the space switcher
 * still works offline (local-first, Architecture §3). Full two-way sync of
 * space/membership records arrives in Phase 18; this is a one-way cache of
 * what the server last told us.
 */

const membershipId = (spaceId: string, userId: string) =>
  `${spaceId}_${userId}`

export async function cacheSpaces(
  spaces: SpaceSummary[],
  userId: string,
): Promise<void> {
  await initDB()
  const now = new Date().toISOString()
  const fetchedIds = new Set(spaces.map((space) => space.id))

  // Drop spaces this user no longer belongs to (left / removed / deleted).
  const localMemberships = await membershipRepository.listByUser(userId)
  for (const membership of localMemberships) {
    if (!fetchedIds.has(membership.spaceId)) {
      await membershipRepository.hardDelete(membership.id)
      const stillReferenced = (
        await membershipRepository.getAllByIndex(
          'by-spaceId',
          membership.spaceId,
        )
      ).length
      if (stillReferenced === 0) {
        await spaceRepository.hardDelete(membership.spaceId)
      }
    }
  }

  for (const space of spaces) {
    await spaceRepository.put({
      id: space.id,
      name: space.name,
      type: space.type,
      ownerId: space.ownerId,
      currency: space.currency,
      createdAt: space.createdAt,
      updatedAt: space.updatedAt,
      deletedAt: null,
      syncStatus: 'SYNCED',
      version: 1,
    })

    await membershipRepository.put({
      id: membershipId(space.id, userId),
      spaceId: space.id,
      userId,
      role: space.role,
      status: 'ACTIVE',
      createdAt: space.createdAt,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'SYNCED',
      version: 1,
    })
  }
}

export async function loadCachedSpaces(
  userId: string,
): Promise<SpaceSummary[]> {
  await initDB()
  const memberships = await membershipRepository.listByUser(userId)

  const summaries: SpaceSummary[] = []
  for (const membership of memberships) {
    if (membership.status !== 'ACTIVE') continue
    const space = await spaceRepository.get(membership.spaceId)
    if (!space) continue
    summaries.push({
      id: space.id,
      name: space.name,
      type: space.type,
      ownerId: space.ownerId,
      // Cached from before this field existed — fall back to Fico's
      // long-standing default rather than leaving it unset.
      currency: space.currency ?? 'PHP',
      role: membership.role,
      createdAt: space.createdAt,
      updatedAt: space.updatedAt,
    })
  }

  return summaries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'PERSONAL' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}
