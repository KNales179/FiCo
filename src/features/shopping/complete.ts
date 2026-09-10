import {
  categoryRepository,
  shoppingItemRepository,
} from '../../repositories'
import { recordTransaction } from '../money'
import {
  recordPurchasePrice,
  resolveItemProfile,
} from '../items'
import { enqueueMutation } from '../sync/enqueue'
import type { MutationContext } from '../sync/context'
import { completeShoppingList } from './lists'

export interface CompletionResult {
  createdCount: number
  spentMinor: number
}

/**
 * Turn a finished shopping list into expenses (Roadmap Phase 9, Architecture
 * §20). Every checked item with an actual price and no linked transaction yet
 * becomes an EXPENSE paid from `accountId`, tagged `SHOPPING_ITEM` + the item
 * id. Idempotent — an item that already has `transactionId` is skipped, so
 * re-running never double-charges.
 */
export const completeListWithExpenses = async (
  ctx: MutationContext,
  listId: string,
  accountId: string,
): Promise<CompletionResult> => {
  const items = await shoppingItemRepository.listByList(listId)

  let createdCount = 0
  let spentMinor = 0

  for (const item of items) {
    if (
      !item.checked ||
      item.transactionId ||
      item.actualPriceMinor == null ||
      item.actualPriceMinor <= 0
    ) {
      continue
    }

    const purchasedAt = new Date().toISOString()
    const profile = await resolveItemProfile(ctx, item.name)
    const categoryName = profile.categoryId
      ? ((await categoryRepository.get(profile.categoryId))?.name ?? null)
      : null

    const txn = await recordTransaction(ctx, {
      type: 'EXPENSE',
      amountMinor: item.actualPriceMinor,
      title: item.name,
      accountId,
      categoryId: profile.categoryId ?? null,
      categoryName,
      occurredAt: purchasedAt,
      sourceType: 'SHOPPING_ITEM',
      sourceId: item.id,
    })

    await recordPurchasePrice(ctx, {
      itemProfileId: profile.id,
      amountMinor: item.actualPriceMinor,
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

    createdCount += 1
    spentMinor += item.actualPriceMinor
  }

  await completeShoppingList(ctx, listId)

  return { createdCount, spentMinor }
}
