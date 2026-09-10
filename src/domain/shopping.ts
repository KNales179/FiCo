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
