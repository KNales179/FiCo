import { beforeEach, describe, expect, it } from 'vitest'
import { ctx, withDB } from '../../test/helpers'
import { categoryRepository, shoppingItemRepository, shoppingListRepository } from '../../repositories'
import { createAccount, computeSpaceBalances, listTransactions } from '../money'
import { listPurchasesForTransaction } from '../items'
import { deleteShoppingList } from '../shopping'
import { listItems } from '../shopping/items'
import { recordItemizedExpense, recordScannedReceipt } from './index'

const c = ctx()

describe('recordScannedReceipt (receipt scanning)', () => {
  beforeEach(withDB)

  it('records the confirmed total, not the sum of the parsed items', async () => {
    const cash = await createAccount(c, {
      name: 'Cash',
      type: 'CASH',
      openingBalanceMinor: 100000,
    })
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

    // Items sum to 135.00, but the receipt's printed total (285.60, incl.
    // tax/rounding the OCR pass didn't itemize) is what gets recorded.
    const { transaction, listId } = await recordScannedReceipt(c, {
      accountId: cash.id,
      title: 'Supermart Groceries',
      occurredAt: '2026-03-14',
      amountMinor: 28560,
      items: [
        {
          name: 'Milk 1L',
          quantity: 2,
          priceMinor: 9000,
          categoryId: groceries.id,
          categoryName: 'Groceries',
        },
        {
          name: 'Bread Loaf',
          quantity: 1,
          priceMinor: 4500,
          categoryId: groceries.id,
          categoryName: 'Groceries',
        },
      ],
    })

    expect(transaction.amountMinor).toBe(28560)
    expect(transaction.sourceType).toBe('SHOPPING_LIST')
    expect(transaction.sourceId).toBe(listId)
    expect(transaction.occurredAt.slice(0, 10)).toBe('2026-03-14')
    // Both items agree, so the trip itself reads as "Groceries".
    expect(transaction.categoryName).toBe('Groceries')

    const bal = await computeSpaceBalances(c.spaceId)
    expect(bal.accounts[0].balanceMinor).toBe(100000 - 28560)

    const items = await listItems(listId)
    expect(items).toHaveLength(2)
    expect(items.every((i) => i.purchased && i.checked)).toBe(true)
    expect(items.every((i) => i.transactionId === transaction.id)).toBe(true)
    expect(items.every((i) => i.itemProfileId != null)).toBe(true)

    const expenses = await listTransactions(c.spaceId, { type: 'EXPENSE' })
    expect(expenses).toHaveLength(1)
  })

  it('leaves the trip uncategorized when its items disagree, but keeps each item specific', async () => {
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

    const { transaction } = await recordScannedReceipt(c, {
      accountId: cash.id,
      title: 'Errand run',
      occurredAt: '2026-04-01',
      amountMinor: 30000,
      items: [
        {
          name: 'Rice',
          quantity: 1,
          priceMinor: 20000,
          categoryId: groceries.id,
          categoryName: 'Groceries',
        },
        {
          name: 'Soap',
          quantity: 1,
          priceMinor: 10000,
          categoryId: household.id,
          categoryName: 'Household',
        },
      ],
    })

    expect(transaction.categoryName).toBeNull()

    // But each item still has its own specific category to build on next time.
    const { suggestForName } = await import('../items')
    expect((await suggestForName(c.spaceId, 'Rice'))?.category).toBe('Groceries')
    expect((await suggestForName(c.spaceId, 'Soap'))?.category).toBe('Household')
  })

  it('an explicit trip category always wins over guessing one from the items', async () => {
    const cash = await createAccount(c, { name: 'Cash', type: 'CASH' })
    const groceries = await categoryRepository.create({
      spaceId: c.spaceId,
      name: 'Groceries',
      normalizedName: 'groceries',
      kind: 'EXPENSE',
      archived: false,
      tracksItems: true,
      createdBy: c.userId,
      syncStatus: 'PENDING',
      version: 1,
    })
    const food = await categoryRepository.create({
      spaceId: c.spaceId,
      name: 'Food',
      normalizedName: 'food',
      kind: 'EXPENSE',
      archived: false,
      tracksItems: false,
      createdBy: c.userId,
      syncStatus: 'PENDING',
      version: 1,
    })

    // Every item resolves to "Food" on its own, but the person picked
    // "Groceries" for the whole trip on the review screen — that choice
    // must stick, not get silently overridden by the item-level guess.
    const { transaction } = await recordScannedReceipt(c, {
      accountId: cash.id,
      title: 'SM Supermarket',
      occurredAt: '2026-09-12',
      amountMinor: 54700,
      categoryId: groceries.id,
      categoryName: 'Groceries',
      items: [
        { name: 'Rice', quantity: 1, priceMinor: 30000, categoryId: food.id, categoryName: 'Food' },
        { name: 'Eggs', quantity: 1, priceMinor: 24700, categoryId: food.id, categoryName: 'Food' },
      ],
    })

    expect(transaction.categoryName).toBe('Groceries')
  })

  it("a receipt's item breakdown survives its shopping list being deleted", async () => {
    const cash = await createAccount(c, { name: 'Cash', type: 'CASH' })
    const { transaction, listId } = await recordScannedReceipt(c, {
      accountId: cash.id,
      title: 'SM Supermarket',
      occurredAt: '2026-09-12',
      amountMinor: 21000,
      items: [
        { name: 'Milk', quantity: 2, priceMinor: 18000, categoryId: null, categoryName: 'Groceries' },
        { name: 'Bread', quantity: 1, priceMinor: 3000, categoryId: null, categoryName: 'Groceries' },
      ],
    })

    // Cleaning up the shopping list — a separate feature — must never
    // erase the transaction's own record of what was bought (owner
    // feedback: "the record and the shopping page is not the same
    // database").
    await deleteShoppingList(c, listId)
    expect(await listItems(listId)).toHaveLength(0)

    const purchases = await listPurchasesForTransaction(transaction.id)
    expect(purchases).toHaveLength(2)
    expect(purchases.find((p) => p.name === 'Milk')).toMatchObject({
      quantity: 2,
      amountMinor: 18000,
      categoryName: 'Groceries',
    })
  })

  it('keeps a null price on an item the review screen never filled in', async () => {
    const cash = await createAccount(c, { name: 'Cash', type: 'CASH' })
    const { listId } = await recordScannedReceipt(c, {
      accountId: cash.id,
      title: 'Corner Store',
      occurredAt: '2026-01-01',
      amountMinor: 5000,
      items: [{ name: 'Mystery item', quantity: 1, priceMinor: null }],
    })

    const items = await listItems(listId)
    expect(items[0].actualPriceMinor).toBeNull()
  })

  it('works with no items at all — just the total', async () => {
    const cash = await createAccount(c, { name: 'Cash', type: 'CASH' })
    const { transaction, listId } = await recordScannedReceipt(c, {
      accountId: cash.id,
      title: 'Unknown shop',
      occurredAt: '2026-02-02',
      amountMinor: 10000,
      items: [],
    })

    expect(transaction.amountMinor).toBe(10000)
    expect(await listItems(listId)).toHaveLength(0)
  })
})

describe('recordItemizedExpense (Quick Add batch entry, Roadmap Phase 26 feedback)', () => {
  beforeEach(withDB)

  it('records the expense and still learns item category/price history, but creates no shopping list', async () => {
    const cash = await createAccount(c, { name: 'Cash', type: 'CASH' })
    const groceries = await categoryRepository.create({
      spaceId: c.spaceId,
      name: 'Groceries',
      normalizedName: 'groceries',
      kind: 'EXPENSE',
      archived: false,
      tracksItems: true,
      createdBy: c.userId,
      syncStatus: 'PENDING',
      version: 1,
    })

    const { transaction } = await recordItemizedExpense(c, {
      accountId: cash.id,
      title: 'Sari-sari store',
      occurredAt: '2026-05-01',
      amountMinor: 15000,
      items: [
        {
          name: 'Rice',
          quantity: 2,
          priceMinor: 15000,
          categoryId: groceries.id,
          categoryName: 'Groceries',
        },
      ],
    })

    expect(transaction.amountMinor).toBe(15000)
    expect(transaction.sourceType).toBe('MANUAL')
    expect(transaction.categoryName).toBe('Groceries')

    // The whole point: adding a batch entry from the dashboard must never
    // show up as a shopping list or an "already bought" item to check off.
    expect(await shoppingListRepository.listBySpace(c.spaceId)).toHaveLength(0)
    expect(await shoppingItemRepository.getAll()).toHaveLength(0)

    // But it still teaches the item's category and price history, same as
    // a scanned receipt would, so "last time" suggestions keep working.
    const { suggestForName } = await import('../items')
    const suggestion = await suggestForName(c.spaceId, 'Rice')
    expect(suggestion?.category).toBe('Groceries')
    expect(suggestion?.lastPriceMinor).toBe(15000)
  })
})
