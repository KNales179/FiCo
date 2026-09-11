import { beforeEach, describe, expect, it } from 'vitest'
import { ctx, withDB } from '../../test/helpers'
import { createAccount, computeSpaceBalances, listTransactions } from '../money'
import { categoryRepository } from '../../repositories'
import {
  addItem,
  createShoppingList,
  deleteShoppingList,
  getShoppingList,
  listItems,
  listShoppingLists,
  setItemChecked,
  updateItem,
} from './index'
import { completeListWithExpenses } from './complete'

const c = ctx()

describe('shopping lists → one expense per trip (Roadmap Phase 9, revised)', () => {
  beforeEach(withDB)

  it('rolls every checked+priced item into a single expense, and exactly once', async () => {
    const cash = await createAccount(c, {
      name: 'Cash',
      type: 'CASH',
      openingBalanceMinor: 500000,
    })
    const list = await createShoppingList(c, { title: 'Groceries' })

    const milk = await addItem(c, list.id, { name: 'Milk' })
    const bread = await addItem(c, list.id, { name: 'Bread' })
    const soda = await addItem(c, list.id, { name: 'Soda' })

    // Milk: checked + priced → counts
    await updateItem(c, milk.id, { actualPriceMinor: 8000 })
    await setItemChecked(c, milk.id, true)
    // Bread: priced but never checked → skipped
    await updateItem(c, bread.id, { actualPriceMinor: 5000 })
    // Soda: checked but no price → skipped
    await setItemChecked(c, soda.id, true)

    const first = await completeListWithExpenses(c, list.id, cash.id)
    expect(first).toEqual({ createdCount: 1, itemCount: 1, spentMinor: 8000 })

    // Re-running is idempotent — the list already has its rollup transaction.
    const second = await completeListWithExpenses(c, list.id, cash.id)
    expect(second).toEqual({ createdCount: 0, itemCount: 0, spentMinor: 0 })

    const expenses = await listTransactions(c.spaceId, { type: 'EXPENSE' })
    expect(expenses).toHaveLength(1)
    expect(expenses[0]).toMatchObject({
      title: 'Groceries',
      amountMinor: 8000,
      sourceType: 'SHOPPING_LIST',
      sourceId: list.id,
    })

    const bal = await computeSpaceBalances(c.spaceId)
    expect(bal.accounts[0].balanceMinor).toBe(492000)

    const items = await listItems(list.id)
    const milkAfter = items.find((i) => i.id === milk.id)!
    expect(milkAfter.purchased).toBe(true)
    expect(milkAfter.transactionId).toBe(expenses[0].id)
  })

  it('sums multiple items into one expense, titled after the list', async () => {
    const cash = await createAccount(c, { name: 'Cash', type: 'CASH' })
    const list = await createShoppingList(c, { title: 'Weekly run' })

    const a = await addItem(c, list.id, { name: 'Rice' })
    const b = await addItem(c, list.id, { name: 'Eggs' })
    for (const [item, price] of [[a, 24000], [b, 9000]] as const) {
      await updateItem(c, item.id, { actualPriceMinor: price })
      await setItemChecked(c, item.id, true)
    }

    const result = await completeListWithExpenses(c, list.id, cash.id)
    expect(result).toEqual({ createdCount: 1, itemCount: 2, spentMinor: 33000 })

    const expenses = await listTransactions(c.spaceId, { type: 'EXPENSE' })
    expect(expenses).toHaveLength(1)
    expect(expenses[0].title).toBe('Weekly run')
    expect(expenses[0].amountMinor).toBe(33000)
  })

  it('a mixed-category trip is left uncategorized rather than guessed', async () => {
    const cash = await createAccount(c, { name: 'Cash', type: 'CASH' })
    const groceries = await categoryRepository.create({
      spaceId: c.spaceId,
      name: 'Groceries',
      normalizedName: 'groceries',
      kind: 'EXPENSE',
      archived: false,
      tracksItems: false,
      createdBy: c.userId,
      syncStatus: 'PENDING',
      version: 1,
    })
    const household = await categoryRepository.create({
      spaceId: c.spaceId,
      name: 'Household',
      normalizedName: 'household',
      kind: 'EXPENSE',
      archived: false,
      tracksItems: false,
      createdBy: c.userId,
      syncStatus: 'PENDING',
      version: 1,
    })

    const list = await createShoppingList(c, { title: 'Errands' })
    const rice = await addItem(c, list.id, { name: 'Rice' })
    const soap = await addItem(c, list.id, { name: 'Soap' })

    const { setItemNameCategory } = await import('../items')
    await setItemNameCategory(c, 'Rice', groceries.id)
    await setItemNameCategory(c, 'Soap', household.id)

    await updateItem(c, rice.id, { actualPriceMinor: 20000 })
    await setItemChecked(c, rice.id, true)
    await updateItem(c, soap.id, { actualPriceMinor: 8000 })
    await setItemChecked(c, soap.id, true)

    await completeListWithExpenses(c, list.id, cash.id)

    const expenses = await listTransactions(c.spaceId, { type: 'EXPENSE' })
    expect(expenses[0].categoryName).toBeNull()
  })

  it('completing a list marks it COMPLETED', async () => {
    const cash = await createAccount(c, { name: 'Cash', type: 'CASH' })
    const list = await createShoppingList(c, { title: 'Trip' })
    await completeListWithExpenses(c, list.id, cash.id)
    const after = await getShoppingList(list.id)
    expect(after?.status).toBe('COMPLETED')
    expect(after?.completedAt).toBeTruthy()
  })

  it('deleting a completed list removes it and its items, but never the expense it already recorded', async () => {
    const cash = await createAccount(c, { name: 'Cash', type: 'CASH' })
    const list = await createShoppingList(c, { title: 'Mistaken batch entry' })
    const rice = await addItem(c, list.id, { name: 'Rice' })
    await updateItem(c, rice.id, { actualPriceMinor: 15000 })
    await setItemChecked(c, rice.id, true)
    await completeListWithExpenses(c, list.id, cash.id)

    await deleteShoppingList(c, list.id)

    expect(await listShoppingLists(c.spaceId)).toHaveLength(0)
    expect(await listItems(list.id)).toHaveLength(0)

    // The recorded expense — real money that was actually spent — stays.
    const expenses = await listTransactions(c.spaceId, { type: 'EXPENSE' })
    expect(expenses).toHaveLength(1)
    expect(expenses[0].amountMinor).toBe(15000)
  })
})
