import { parseAmountToMinor } from '../../domain/money'
import type { ScannedReceiptItemInput } from '../../features/receipts'

/**
 * One row of an itemized entry — a scanned receipt's line items, or a
 * manually itemized "batch buying" purchase (Roadmap Phase 26 feedback: any
 * category marked `tracksItems`, e.g. Groceries/Shopping, switches Quick Add
 * to this same row editor instead of a single amount).
 */
export interface DraftItem {
  id: number
  name: string
  quantity: string
  /** Price *per unit* — '' means blank/unset — flagged in the UI, never guessed. */
  price: string
  /** '' = no category. Suggested from a past purchase of the same item, never invented. */
  categoryId: string
}

/** A blank/unparseable quantity defaults to 1 — never zero, never negative. */
export const parseItemQuantity = (quantity: string): number =>
  Math.max(1, Math.round(Number(quantity)) || 1)

/** This row's contribution to the trip's total: unit price × quantity, or null if the price is blank. */
export const rowTotalMinor = (row: DraftItem): number | null => {
  const unitMinor = parseAmountToMinor(row.price)
  return unitMinor == null ? null : unitMinor * parseItemQuantity(row.quantity)
}

export const sumItemPricesMinor = (rows: DraftItem[]): number =>
  rows.reduce((sum, r) => sum + (rowTotalMinor(r) ?? 0), 0)

export const newBlankItem = (rows: DraftItem[]): DraftItem => ({
  id: (rows.at(-1)?.id ?? -1) + 1,
  name: '',
  quantity: '1',
  price: '',
  categoryId: '',
})

/** Rows with a name, ready to send to `recordScannedReceipt` — `priceMinor` is the line's total (unit price × quantity), not the unit price itself. */
export const toScannedReceiptItems = (
  rows: DraftItem[],
  categoryNameById: Map<string, string>,
): ScannedReceiptItemInput[] =>
  rows
    .filter((row) => row.name.trim())
    .map((row) => ({
      name: row.name.trim(),
      quantity: parseItemQuantity(row.quantity),
      priceMinor: rowTotalMinor(row),
      categoryId: row.categoryId || null,
      categoryName: row.categoryId
        ? categoryNameById.get(row.categoryId) ?? null
        : null,
    }))
