import {
  categoryRepository,
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
  categoryId: string | null
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

  const category = profile.categoryId
    ? ((await categoryRepository.get(profile.categoryId))?.name ?? null)
    : null

  return {
    itemProfileId: profile.id,
    displayName: profile.displayName,
    categoryId: profile.categoryId ?? null,
    category,
    lastPriceMinor: latest?.amountMinor ?? null,
    lastPurchasedAt: latest?.purchasedAt ?? null,
    priceCount: prices.length,
  }
}

export interface ItemPurchaseDetail {
  name: string
  amountMinor: number
}

/**
 * The itemized lines behind one transaction, when there are any — this is
 * how a dashboard batch entry (Quick Add's itemized mode) shows its item
 * breakdown, since unlike a scanned receipt it has no shopping list to
 * read that from (Roadmap feedback: deliberately never creates one).
 * Price history rows are linked to the transaction that recorded them
 * regardless of which path created them, so this works the same either way.
 */
export const listPurchasesForTransaction = async (
  transactionId: string,
): Promise<ItemPurchaseDetail[]> => {
  const rows = (await priceHistoryRepository.getAll()).filter(
    (row) => row.transactionId === transactionId,
  )
  const profiles = await Promise.all(
    rows.map((row) => itemProfileRepository.get(row.itemProfileId)),
  )
  return rows.map((row, i) => ({
    name: profiles[i]?.displayName ?? 'Item',
    amountMinor: row.amountMinor,
  }))
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
export const setProfileCategory = async (
  ctx: MutationContext,
  profileId: string,
  categoryId: string | null,
): Promise<ItemProfile> => {
  const profile = await itemProfileRepository.update(profileId, {
    categoryId,
    syncStatus: 'PENDING',
  })
  await enqueueMutation(ctx, 'itemProfile', profileId, 'UPDATE', profile)
  return profile
}

/** Resolve/create the profile for an item name, then set its category. */
export const setItemNameCategory = async (
  ctx: MutationContext,
  name: string,
  categoryId: string | null,
): Promise<ItemProfile> => {
  const profile = await resolveItemProfile(ctx, name)
  return setProfileCategory(ctx, profile.id, categoryId)
}

export { normalizeItemName }
