import type {
  ItemProfile,
  PriceHistory,
  ShoppingItem,
  ShoppingList,
} from '../types/models'
import { createRepository } from './createRepository'

const shoppingLists = createRepository('shoppingLists')
const shoppingItems = createRepository('shoppingItems')
const itemProfiles = createRepository('itemProfiles')
const priceHistory = createRepository('priceHistory')

export const shoppingListRepository = {
  ...shoppingLists,

  async listBySpace(spaceId: string): Promise<ShoppingList[]> {
    return shoppingLists.getAllByIndex('by-spaceId', spaceId)
  },

  async listActive(spaceId: string): Promise<ShoppingList[]> {
    const rows = await shoppingLists.getAllByIndex('by-spaceId', spaceId)
    return rows.filter((list) => list.status === 'ACTIVE')
  },
}

export const shoppingItemRepository = {
  ...shoppingItems,

  async listByList(shoppingListId: string): Promise<ShoppingItem[]> {
    return shoppingItems.getAllByIndex(
      'by-shoppingListId',
      shoppingListId,
    )
  },
}

export const itemProfileRepository = {
  ...itemProfiles,

  async listBySpace(spaceId: string): Promise<ItemProfile[]> {
    return itemProfiles.getAllByIndex('by-spaceId', spaceId)
  },

  /** Look up a known item by its normalized name within a space. */
  async findByNormalizedName(
    spaceId: string,
    normalizedName: string,
  ): Promise<ItemProfile | undefined> {
    return itemProfiles.getByIndex('by-space-normalizedName', [
      spaceId,
      normalizedName,
    ])
  },
}

export const priceHistoryRepository = {
  ...priceHistory,

  async listByProfile(itemProfileId: string): Promise<PriceHistory[]> {
    const rows = await priceHistory.getAllByIndex(
      'by-itemProfileId',
      itemProfileId,
    )
    return rows.sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt))
  },

  /** Most recent recorded price for an item, used for price suggestions (§19). */
  async latestForProfile(
    itemProfileId: string,
  ): Promise<PriceHistory | undefined> {
    const rows = await this.listByProfile(itemProfileId)
    return rows[0]
  },
}
