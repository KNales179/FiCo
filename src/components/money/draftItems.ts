import { parseAmountToMinor } from '../../domain/money'
import type { ScannedReceiptItemInput } from '../../features/receipts'

/** "pcs" (a whole piece count) or "kg" (weight — decimals allowed, e.g. 0.756kg of pork). */
export type ItemUnit = 'pcs' | 'kg'

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
  unit: ItemUnit
  /** Price *per unit* — '' means blank/unset — flagged in the UI, never guessed. */
  price: string
  /** '' = no category. Suggested from a past purchase of the same item, never invented. */
  categoryId: string
}

/**
 * A "pcs" quantity is always a whole piece count — a blank/unparseable one
 * defaults to 1, never zero or negative. A "kg" quantity is a weight and
 * keeps its decimal precision (0.756kg of pork is a real amount, not "1").
 */
export const parseItemQuantity = (
  quantity: string,
  unit: ItemUnit = 'pcs',
): number => {
  const parsed = Number(quantity)
  if (unit === 'kg') {
    return parsed > 0 ? parsed : 1
  }
  return Math.max(1, Math.round(parsed) || 1)
}

/** This row's contribution to the trip's total: unit price × quantity (rounded to the nearest centavo), or null if the price is blank. */
export const rowTotalMinor = (row: DraftItem): number | null => {
  const unitMinor = parseAmountToMinor(row.price)
  return unitMinor == null
    ? null
    : Math.round(unitMinor * parseItemQuantity(row.quantity, row.unit))
}

export const sumItemPricesMinor = (rows: DraftItem[]): number =>
  rows.reduce((sum, r) => sum + (rowTotalMinor(r) ?? 0), 0)

export const newBlankItem = (rows: DraftItem[]): DraftItem => ({
  id: (rows.at(-1)?.id ?? -1) + 1,
  name: '',
  quantity: '1',
  unit: 'pcs',
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
      quantity: parseItemQuantity(row.quantity, row.unit),
      priceMinor: rowTotalMinor(row),
      categoryId: row.categoryId || null,
      categoryName: row.categoryId
        ? categoryNameById.get(row.categoryId) ?? null
        : null,
    }))
