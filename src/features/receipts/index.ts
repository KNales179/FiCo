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
 * Resolve each item's profile (learning a new category choice for *future*
 * purchases, never rewriting history — §10), pick the trip's overall
 * category from what the items share, and record the one EXPENSE for the
 * confirmed total. Shared by `recordScannedReceipt` (an actual scanned
 * receipt, which also builds a shopping-list record out of the result) and
 * `recordItemizedExpense` (Quick Add's batch entry, which doesn't — see
 * there for why).
 *
 * The transaction amount is always what the person confirmed on the review
 * screen, not a sum of the (best-effort) parsed items — those can be
 * incomplete or wrong without making the recorded amount wrong.
 */
const recordItemizedTransaction = async (
  ctx: MutationContext,
  input: ScannedReceiptInput,
  sourceType: Transaction['sourceType'],
  sourceId: string | null,
) => {
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

  // An explicit category the person picked for the whole trip (Shopping's
  // "Complete shopping" bar, Quick Add's category picker, or a scanned
  // receipt's review screen) always wins outright — it's a conscious
  // choice, not a guess. Only when nothing was picked does this fall back
  // to deriving one from what the items themselves share.
  const tripCategory = input.categoryId
    ? { categoryId: input.categoryId, categoryName: input.categoryName ?? null }
    : resolved.length > 0
      ? pickTripCategory(
          resolved.map((r) => ({
            categoryId: r.categoryId,
            categoryName: r.categoryName,
          })),
        )
      : { categoryId: null, categoryName: null }

  const txn = await recordTransaction(ctx, {
    type: 'EXPENSE',
    amountMinor: input.amountMinor,
    title: input.title.trim() || 'Scanned receipt',
    accountId: input.accountId,
    categoryId: tripCategory.categoryId,
    categoryName: tripCategory.categoryName,
    occurredAt: input.occurredAt,
    sourceType,
    sourceId,
  })

  const purchasedAt = new Date().toISOString()
  for (const { row, profileId, categoryName } of resolved) {
    if (row.priceMinor != null && row.priceMinor > 0) {
      await recordPurchasePrice(ctx, {
        itemProfileId: profileId,
        amountMinor: row.priceMinor,
        purchasedAt,
        transactionId: txn.id,
        name: row.name.trim(),
        quantity: row.quantity,
        categoryName,
      })
    }
  }

  return { txn, resolved }
}

/**
 * Records a receipt that was scanned and reviewed (Roadmap Phase 26
 * feedback). One EXPENSE for the confirmed total, tagged `SHOPPING_LIST` so
 * it rolls up and expands exactly like a manually completed shopping trip
 * (§ shopping -> expenses); the parsed line items become that list's items,
 * already checked and purchased, so "last time" suggestions and price
 * history pick them up the same as any other purchase.
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

  const { txn, resolved } = await recordItemizedTransaction(
    ctx,
    input,
    'SHOPPING_LIST',
    list.id,
  )

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
  }

  return { transaction: txn, listId: list.id }
}

/**
 * Quick Add's batch entry for a category marked "tracks items" (Roadmap
 * Phase 26 feedback) — a grocery run logged straight from the dashboard,
 * not from the Shopping page. Records the one EXPENSE and still teaches
 * each item's category/price history, exactly like a scanned receipt does,
 * but deliberately does **not** create a shopping list or its items: the
 * Shopping page is the one that feeds the dashboard (completing a list
 * there becomes a transaction), never the other way around — a dashboard
 * entry has no shopping list to attach to and shouldn't invent one.
 */
export const recordItemizedExpense = async (
  ctx: MutationContext,
  input: ScannedReceiptInput,
): Promise<{ transaction: Transaction }> => {
  const { txn } = await recordItemizedTransaction(ctx, input, 'MANUAL', null)
  return { transaction: txn }
}
