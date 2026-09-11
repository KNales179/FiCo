import type { ShoppingItem, ShoppingList } from '../types/models'

export interface ListTotals {
  itemCount: number
  checkedCount: number
  /** Actual price where entered, otherwise planned price, summed. */
  projectedTotalMinor: number
  /** Actual prices on checked items — money considered spent. */
  spentMinor: number
  /** plannedBudget − spent, or null when no budget was set. */
  remainingBudgetMinor: number | null
}

/**
 * Item prices are line totals (the amount for that item as a whole), matching
 * the Product Spec examples. Mirrors `computeListTotals` on the server.
 */
export const computeListTotals = (
  list: Pick<ShoppingList, 'plannedBudgetMinor'>,
  items: Array<
    Pick<
      ShoppingItem,
      'plannedPriceMinor' | 'actualPriceMinor' | 'checked'
    >
  >,
): ListTotals => {
  let projectedTotalMinor = 0
  let spentMinor = 0
  let checkedCount = 0

  for (const item of items) {
    const planned = item.plannedPriceMinor ?? 0
    const actual = item.actualPriceMinor ?? undefined

    projectedTotalMinor += actual ?? planned

    if (item.checked) {
      checkedCount += 1
      spentMinor += actual ?? planned
    }
  }

  const budget = list.plannedBudgetMinor
  return {
    itemCount: items.length,
    checkedCount,
    projectedTotalMinor,
    spentMinor,
    remainingBudgetMinor:
      budget != null ? budget - spentMinor : null,
  }
}

export interface CategorizedLine {
  categoryId: string | null
  categoryName: string | null
}

/**
 * The category most of a trip's line items share, for rolling several items
 * into one expense (Roadmap Phase 9/26). A genuine tie for the lead — or no
 * categorized items at all — counts as a mixed trip and is left
 * uncategorized rather than guessed. Shared by `completeListWithExpenses`
 * and `recordScannedReceipt` so a trip is categorized the same way whether
 * it was checked off by hand or read off a receipt photo.
 */
export const pickTripCategory = (lines: CategorizedLine[]): CategorizedLine => {
  const counts = new Map<string, number>()
  for (const line of lines) {
    if (line.categoryName) {
      counts.set(line.categoryName, (counts.get(line.categoryName) ?? 0) + 1)
    }
  }

  const maxCount = Math.max(0, ...counts.values())
  const leaders = [...counts.entries()].filter(([, count]) => count === maxCount)
  if (leaders.length !== 1) return { categoryId: null, categoryName: null }

  const [name] = leaders[0]
  const match = lines.find((line) => line.categoryName === name)
  return { categoryId: match?.categoryId ?? null, categoryName: name }
}
