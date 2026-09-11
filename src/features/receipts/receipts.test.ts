import { beforeEach, describe, expect, it } from 'vitest'
import { ctx, withDB } from '../../test/helpers'
import { categoryRepository } from '../../repositories'
import { createAccount, computeSpaceBalances, listTransactions } from '../money'
import { listItems } from '../shopping/items'
import { recordScannedReceipt } from './index'

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
