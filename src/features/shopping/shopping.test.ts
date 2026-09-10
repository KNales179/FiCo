import { beforeEach, describe, expect, it } from 'vitest'
import { ctx, withDB } from '../../test/helpers'
import { createAccount, computeSpaceBalances, listTransactions } from '../money'
import {
  addItem,
  createShoppingList,
  listItems,
  setItemChecked,
  updateItem,
} from './index'
import { completeListWithExpenses } from './complete'

const c = ctx()

describe('shopping lists → expenses (Phase 9)', () => {
  beforeEach(withDB)

  it('only checked, priced items become expenses, and exactly once', async () => {
    const cash = await createAccount(c, {
      name: 'Cash',
      type: 'CASH',
      openingBalanceMinor: 500000,
    })
    const list = await createShoppingList(c, { title: 'Weekly' })

    const milk = await addItem(c, list.id, { name: 'Milk' })
    const bread = await addItem(c, list.id, { name: 'Bread' })
    const soda = await addItem(c, list.id, { name: 'Soda' })

    // Milk: checked + priced → becomes an expense
    await updateItem(c, milk.id, { actualPriceMinor: 8000 })
    await setItemChecked(c, milk.id, true)
    // Bread: priced but never checked → skipped
    await updateItem(c, bread.id, { actualPriceMinor: 5000 })
    // Soda: checked but no price → skipped
    await setItemChecked(c, soda.id, true)

    const first = await completeListWithExpenses(c, list.id, cash.id)
    expect(first).toEqual({ createdCount: 1, spentMinor: 8000 })

    // Re-running is idempotent — the linked item is skipped.
    const second = await completeListWithExpenses(c, list.id, cash.id)
    expect(second).toEqual({ createdCount: 0, spentMinor: 0 })

    const expenses = await listTransactions(c.spaceId, { type: 'EXPENSE' })
    expect(expenses).toHaveLength(1)
    expect(expenses[0]).toMatchObject({
      title: 'Milk',
      amountMinor: 8000,
      sourceType: 'SHOPPING_ITEM',
      sourceId: milk.id,
    })

    const bal = await computeSpaceBalances(c.spaceId)
    expect(bal.accounts[0].balanceMinor).toBe(492000)

    const items = await listItems(list.id)
    const milkAfter = items.find((i) => i.id === milk.id)!
    expect(milkAfter.purchased).toBe(true)
    expect(milkAfter.transactionId).toBeTruthy()
  })

  it('completing a list marks it COMPLETED', async () => {
    const cash = await createAccount(c, { name: 'Cash', type: 'CASH' })
    const list = await createShoppingList(c, { title: 'Trip' })
    await completeListWithExpenses(c, list.id, cash.id)
    const { getShoppingList } = await import('./lists')
    const after = await getShoppingList(list.id)
    expect(after?.status).toBe('COMPLETED')
    expect(after?.completedAt).toBeTruthy()
  })
})
