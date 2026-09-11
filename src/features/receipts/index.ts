import {
  shoppingItemRepository,
  shoppingListRepository,
} from '../../repositories'
import { recordTransaction } from '../money'
import {
  recordPurchasePrice,
  resolveItemProfile,
  setProfileCategory,
} from '../items'
import { enqueueMutation } from '../sync/enqueue'
import type { MutationContext } from '../sync/context'
import { pickTripCategory } from '../../domain/shopping'
import type { Transaction } from '../../types/models'

export interface ScannedReceiptItemInput {
  name: string
  quantity: number
  /** null when the person reviewing the scan couldn't fill this in either. */
  priceMinor: number | null
  /** The category confirmed on the review screen — Fico suggests one from
   *  past purchases of the same item, but never invents a new one (§10). */
  categoryId?: string | null
  categoryName?: string | null
}

export interface ScannedReceiptInput {
  accountId: string
  /** Merchant name, or whatever the person confirmed on the review screen. */
  title: string
  /** ISO date the purchase actually happened — never defaulted to "today" (§ receipt scanning). */
  occurredAt: string
  /** The amount the person confirmed — the receipt's printed total, not a re-derived sum. */
  amountMinor: number
  /** Only used when there are no items to derive a category from. */
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
 * incomplete or wrong without making the recorded amount wrong. The
 * transaction's category is the one most of the reviewed items share
 * (`pickTripCategory`) — the same rule a manually completed trip uses — so a
 * receipt full of groceries reads as "Groceries" even though each item kept
 * its own specific category underneath.
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

  // Resolve each item's profile first, and remember a category the person
  // picked that differs from what Fico already had on file — that becomes
  // the item's new default for *future* purchases, never rewriting history
  // (§10), matching how a manually completed trip categorizes items.
  const resolved = await Promise.all(
    input.items.map(async (row) => {
      const profile = await resolveItemProfile(ctx, row.name)
      const categoryId = row.categoryId ?? profile.categoryId ?? null
      if (categoryId !== (profile.categoryId ?? null)) {
        await setProfileCategory(ctx, profile.id, categoryId)
      }
      return {
        row,
        profileId: profile.id,
        categoryId,
        categoryName: row.categoryName ?? null,
      }
    }),
  )

  const tripCategory =
    resolved.length > 0
      ? pickTripCategory(
          resolved.map((r) => ({
            categoryId: r.categoryId,
            categoryName: r.categoryName,
          })),
        )
      : { categoryId: input.categoryId ?? null, categoryName: input.categoryName ?? null }

  const txn = await recordTransaction(ctx, {
    type: 'EXPENSE',
    amountMinor: input.amountMinor,
    title: input.title.trim() || 'Scanned receipt',
    accountId: input.accountId,
    categoryId: tripCategory.categoryId,
    categoryName: tripCategory.categoryName,
    occurredAt: input.occurredAt,
    sourceType: 'SHOPPING_LIST',
    sourceId: list.id,
  })

  const purchasedAt = new Date().toISOString()

  for (const { row, profileId } of resolved) {
    const item = await shoppingItemRepository.create({
      spaceId: ctx.spaceId,
      shoppingListId: list.id,
      itemProfileId: profileId,
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
        itemProfileId: profileId,
        amountMinor: row.priceMinor,
        purchasedAt,
        transactionId: txn.id,
      })
    }
  }

  return { transaction: txn, listId: list.id }
}
