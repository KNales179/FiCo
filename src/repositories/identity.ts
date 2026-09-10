import { getDB } from '../db/database'
import type { LocalUser, Membership, Space } from '../types/models'
import { createRepository } from './createRepository'

const users = createRepository('users')
const spaces = createRepository('spaces')
const memberships = createRepository('memberships')

export const userRepository = {
  ...users,

  async findByUsername(username: string): Promise<LocalUser | undefined> {
    return users.getByIndex('by-username', username)
  },

  /** Insert or replace a cached user by id. */
  async upsert(user: LocalUser): Promise<void> {
    const db = await getDB()
    await db.put('users', user)
  },
}

export const spaceRepository = {
  ...spaces,

  async listByOwner(ownerId: string): Promise<Space[]> {
    return spaces.getAllByIndex('by-ownerId', ownerId)
  },
}

export const membershipRepository = {
  ...memberships,

  async listBySpace(spaceId: string): Promise<Membership[]> {
    return memberships.getAllByIndex('by-spaceId', spaceId)
  },

  async listByUser(userId: string): Promise<Membership[]> {
    return memberships.getAllByIndex('by-userId', userId)
  },

  async findMember(
    spaceId: string,
    userId: string,
  ): Promise<Membership | undefined> {
    return memberships.getByIndex('by-space-user', [spaceId, userId])
  },
}
