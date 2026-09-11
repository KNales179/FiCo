import {
  shoppingItemRepository,
  shoppingListRepository,
} from '../../repositories'
import { recordTransaction } from '../money'
import { recordPurchasePrice, resolveItemProfile } from '../items'
import { enqueueMutation } from '../sync/enqueue'
import type { MutationContext } from '../sync/context'
import type { Transaction } from '../../types/models'

export interface ScannedReceiptItemInput {
  name: string
  quantity: number
  /** null when the person reviewing the scan couldn't fill this in either. */
  priceMinor: number | null
}

export interface ScannedReceiptInput {
  accountId: string
  /** Merchant name, or whatever the person confirmed on the review screen. */
  title: string
  /** ISO date the purchase actually happened — never defaulted to "today" (§ receipt scanning). */
  occurredAt: string
  /** The amount the person confirmed — the receipt's printed total, not a re-derived sum. */
  amountMinor: number
  categoryId?: string | null
  categoryName?: string | null
  items: ScannedReceiptItemInput[]
}

export interface ScannedReceiptResult {
  transaction: Transaction
  listId: string
}

/**
 * Records a receipt that was scanned and reviewed (Roadmap Phase 26
 * feedback). One EXPENSE for the confirmed total, tagged `SHOPPING_LIST` so
 * it rolls up and expands exactly like a manually completed shopping trip
 * (§ shopping -> expenses); the parsed line items become that list's items,
 * already checked and purchased, so "last time" suggestions and price
 * history pick them up the same as any other purchase.
 *
 * The transaction amount is always what the person confirmed on the review
 * screen, not a sum of the (best-effort) parsed items — those can be
 * incomplete or wrong without making the recorded amount wrong.
 */
export const recordScannedReceipt = async (
  ctx: MutationContext,
  input: ScannedReceiptInput,
): Promise<ScannedReceiptResult> => {
  const list = await shoppingListRepository.create({
    spaceId: ctx.spaceId,
    title: input.title.trim() || 'Scanned receipt',
    status: 'COMPLETED',
    plannedBudgetMinor: null,
    plannedAt: null,
    completedAt: new Date().toISOString(),
    visibility: 'SPACE',
    createdBy: ctx.userId,
    syncStatus: 'PENDING',
    version: 1,
  })
  await enqueueMutation(ctx, 'shoppingList', list.id, 'CREATE', list)

  const txn = await recordTransaction(ctx, {
    type: 'EXPENSE',
    amountMinor: input.amountMinor,
    title: input.title.trim() || 'Scanned receipt',
    accountId: input.accountId,
    categoryId: input.categoryId ?? null,
    categoryName: input.categoryName ?? null,
    occurredAt: input.occurredAt,
    sourceType: 'SHOPPING_LIST',
    sourceId: list.id,
  })

  const purchasedAt = new Date().toISOString()

  for (const row of input.items) {
    const profile = await resolveItemProfile(ctx, row.name)

    const item = await shoppingItemRepository.create({
      spaceId: ctx.spaceId,
      shoppingListId: list.id,
      itemProfileId: profile.id,
      name: row.name.trim(),
      plannedPriceMinor: null,
      actualPriceMinor: row.priceMinor,
      quantity: row.quantity,
      checked: true,
      purchased: true,
      addedDuringTrip: false,
      transactionId: txn.id,
      createdBy: ctx.userId,
      syncStatus: 'PENDING',
      version: 1,
    })
    await enqueueMutation(ctx, 'shoppingItem', item.id, 'CREATE', item)

    if (row.priceMinor != null && row.priceMinor > 0) {
      await recordPurchasePrice(ctx, {
        itemProfileId: profile.id,
        amountMinor: row.priceMinor,
        purchasedAt,
        transactionId: txn.id,
      })
    }
  }

  return { transaction: txn, listId: list.id }
}
