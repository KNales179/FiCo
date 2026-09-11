import {
  categoryRepository,
  shoppingItemRepository,
  shoppingListRepository,
  transactionRepository,
} from '../../repositories'
import { recordTransaction } from '../money'
import { recordPurchasePrice, resolveItemProfile } from '../items'
import { enqueueMutation } from '../sync/enqueue'
import type { MutationContext } from '../sync/context'
import { completeShoppingList } from './lists'

export interface CompletionResult {
  /** Expense transactions created — 0 (nothing eligible, or already done) or 1. */
  createdCount: number
  /** How many items were rolled into that transaction. */
  itemCount: number
  spentMinor: number
}

/**
 * Turn a finished shopping list into **one** expense (Roadmap Phase 9,
 * revised after Phase 26 feedback): every checked item with an actual price
 * and no linked transaction yet is summed into a single EXPENSE, titled after
 * the list and tagged `SHOPPING_LIST` + the list id, so a trip shows as one
 * line ("Groceries ₱850") that expands to the itemized detail instead of
 * flooding the ledger with one row per item. The category is whichever
 * category most of the items share; a mixed trip is left uncategorized
 * rather than guessed.
 *
 * Idempotent — a list that already produced its rollup transaction is
 * skipped, so re-running (or completing twice) never double-charges.
 */
export const completeListWithExpenses = async (
  ctx: MutationContext,
  listId: string,
  accountId: string,
): Promise<CompletionResult> => {
  const alreadyRolledUp = await transactionRepository.findBySource(
    'SHOPPING_LIST',
    listId,
  )
  if (alreadyRolledUp) {
    await completeShoppingList(ctx, listId)
    return { createdCount: 0, itemCount: 0, spentMinor: 0 }
  }

  const [list, items] = await Promise.all([
    shoppingListRepository.get(listId),
    shoppingItemRepository.listByList(listId),
  ])

  const eligible = items.filter(
    (item) =>
      item.checked &&
      !item.transactionId &&
      item.actualPriceMinor != null &&
      item.actualPriceMinor > 0,
  )

  if (eligible.length === 0) {
    await completeShoppingList(ctx, listId)
    return { createdCount: 0, itemCount: 0, spentMinor: 0 }
  }

  const purchasedAt = new Date().toISOString()

  // Resolve each item's profile/category up front — needed both to bill the
  // trip and to keep price history for "last time" suggestions (§10).
  const resolved = await Promise.all(
    eligible.map(async (item) => {
      const profile = await resolveItemProfile(ctx, item.name)
      const categoryName = profile.categoryId
        ? ((await categoryRepository.get(profile.categoryId))?.name ?? null)
        : null
      return { item, profile, categoryName }
    }),
  )

  // The category most of the trip's items share; leave it uncategorized
  // rather than pick one arbitrarily when the trip is genuinely mixed (a tie
  // for the lead counts as mixed, not a coin flip).
  const counts = new Map<string, number>()
  for (const r of resolved) {
    if (r.categoryName) counts.set(r.categoryName, (counts.get(r.categoryName) ?? 0) + 1)
  }
  const maxCount = Math.max(0, ...counts.values())
  const leaders = [...counts.entries()].filter(([, count]) => count === maxCount)
  const tripCategoryName = leaders.length === 1 ? leaders[0][0] : null
  const tripCategoryId =
    resolved.find((r) => r.categoryName === tripCategoryName)?.profile
      .categoryId ?? null

  const spentMinor = eligible.reduce(
    (sum, item) => sum + item.actualPriceMinor!,
    0,
  )

  const txn = await recordTransaction(ctx, {
    type: 'EXPENSE',
    amountMinor: spentMinor,
    title: list?.title ?? 'Shopping',
    accountId,
    categoryId: tripCategoryId,
    categoryName: tripCategoryName,
    occurredAt: purchasedAt,
    sourceType: 'SHOPPING_LIST',
    sourceId: listId,
  })

  for (const { item, profile } of resolved) {
    await recordPurchasePrice(ctx, {
      itemProfileId: profile.id,
      amountMinor: item.actualPriceMinor!,
      purchasedAt,
      transactionId: txn.id,
    })

    const linked = await shoppingItemRepository.update(item.id, {
      transactionId: txn.id,
      itemProfileId: profile.id,
      purchased: true,
      syncStatus: 'PENDING',
    })
    await enqueueMutation(ctx, 'shoppingItem', item.id, 'UPDATE', linked)
  }

  await completeShoppingList(ctx, listId)

  return { createdCount: 1, itemCount: eligible.length, spentMinor }
}
