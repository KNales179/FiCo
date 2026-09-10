import {
  itemProfileRepository,
  priceHistoryRepository,
} from '../../repositories'
import { normalizeItemName } from '../../domain/items'
import { enqueueMutation } from '../sync/enqueue'
import type { MutationContext } from '../sync/context'
import type { ItemProfile } from '../../types/models'

export interface ItemSuggestion {
  itemProfileId: string
  displayName: string
  category: string | null
  lastPriceMinor: number | null
  lastPurchasedAt: string | null
  priceCount: number
}

/** Find the profile for a name in a space, creating it on first sight (§10). */
export const resolveItemProfile = async (
  ctx: MutationContext,
  name: string,
): Promise<ItemProfile> => {
  const normalizedName = normalizeItemName(name)

  const existing = await itemProfileRepository.findByNormalizedName(
    ctx.spaceId,
    normalizedName,
  )
  if (existing) return existing

  const profile = await itemProfileRepository.create({
    spaceId: ctx.spaceId,
    normalizedName,
    displayName: name.trim(),
    categoryId: null,
    category: null,
    syncStatus: 'PENDING',
    version: 1,
  })
  await enqueueMutation(ctx, 'itemProfile', profile.id, 'CREATE', profile)
  return profile
}

/** What Fico knows about an item, from local data (§9, §10). */
export const suggestForName = async (
  spaceId: string,
  name: string,
): Promise<ItemSuggestion | null> => {
  const normalizedName = normalizeItemName(name)
  if (!normalizedName) return null

  const profile = await itemProfileRepository.findByNormalizedName(
    spaceId,
    normalizedName,
  )
  if (!profile) return null

  const prices = await priceHistoryRepository.listByProfile(profile.id)
  const latest = prices[0]

  return {
    itemProfileId: profile.id,
    displayName: profile.displayName,
    category: profile.category ?? null,
    lastPriceMinor: latest?.amountMinor ?? null,
    lastPurchasedAt: latest?.purchasedAt ?? null,
    priceCount: prices.length,
  }
}

export const recordPurchasePrice = async (
  ctx: MutationContext,
  params: {
    itemProfileId: string
    amountMinor: number
    purchasedAt: string
    transactionId?: string | null
  },
): Promise<void> => {
  const entry = await priceHistoryRepository.create({
    itemProfileId: params.itemProfileId,
    amountMinor: params.amountMinor,
    purchasedAt: params.purchasedAt,
    transactionId: params.transactionId ?? null,
  })
  await enqueueMutation(ctx, 'priceHistory', entry.id, 'CREATE', entry)
}

/** Set an item's category. Affects future purchases only — never past ones (§10). */
export const updateProfileCategory = async (
  ctx: MutationContext,
  id: string,
  category: string | null,
): Promise<ItemProfile> => {
  const profile = await itemProfileRepository.update(id, {
    category,
    syncStatus: 'PENDING',
  })
  await enqueueMutation(ctx, 'itemProfile', id, 'UPDATE', profile)
  return profile
}

export { normalizeItemName }
