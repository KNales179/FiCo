import type { Category, CategoryKind } from '../types/models'
import { createRepository } from './createRepository'

const base = createRepository('categories')

export const categoryRepository = {
  ...base,

  listBySpace(spaceId: string): Promise<Category[]> {
    return base.getAllByIndex('by-spaceId', spaceId)
  },

  listByKind(
    spaceId: string,
    kind: CategoryKind,
  ): Promise<Category[]> {
    return base.getAllByIndex('by-space-kind', [spaceId, kind])
  },

  async findByName(
    spaceId: string,
    kind: CategoryKind,
    normalizedName: string,
  ): Promise<Category | undefined> {
    const rows = await base.getAllByIndex('by-space-kind', [
      spaceId,
      kind,
    ])
    return rows.find((c) => c.normalizedName === normalizedName)
  },
}
