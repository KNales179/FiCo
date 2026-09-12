import { beforeEach, describe, expect, it } from 'vitest'
import { ctx, withDB } from '../../test/helpers'
import { categoryRepository } from '../../repositories'
import { createAccount } from '../money'
import { createShoppingList, addItem, setItemChecked, updateItem } from '../shopping'
import { completeListWithExpenses } from '../shopping/complete'
import {
  listPurchasesForTransaction,
  resolveItemProfile,
  setItemNameCategory,
  suggestForName,
} from './index'

const c = ctx()

describe('item profiles (§10)', () => {
  beforeEach(withDB)

  it('resolves the same profile for names that differ only in case/spacing', async () => {
    const a = await resolveItemProfile(c, 'Whole Milk')
    const b = await resolveItemProfile(c, '  whole   milk ')
    expect(b.id).toBe(a.id)
  })

  it('category is applied to future purchases only, never past ones', async () => {
    const cat = await categoryRepository.create({
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
    const cash = await createAccount(c, { name: 'Cash', type: 'CASH' })

    // First purchase — no category set yet.
    const list1 = await createShoppingList(c, { title: 'T1' })
    const eggs1 = await addItem(c, list1.id, { name: 'Eggs' })
    await updateItem(c, eggs1.id, { actualPriceMinor: 12000 })
    await setItemChecked(c, eggs1.id, true)
    await completeListWithExpenses(c, list1.id, cash.id)

    await setItemNameCategory(c, 'Eggs', cat.id)

    // Second purchase — now categorised.
    const list2 = await createShoppingList(c, { title: 'T2' })
    const eggs2 = await addItem(c, list2.id, { name: 'eggs' })
    await updateItem(c, eggs2.id, { actualPriceMinor: 13000 })
    await setItemChecked(c, eggs2.id, true)
    await completeListWithExpenses(c, list2.id, cash.id)

    const { listTransactions } = await import('../money')
    const expenses = await listTransactions(c.spaceId, { type: 'EXPENSE' })
    const byAmount = Object.fromEntries(
      expenses.map((e) => [e.amountMinor, e.categoryName]),
    )
    expect(byAmount[12000]).toBeNull()
    expect(byAmount[13000]).toBe('Groceries')
  })

  it('suggestForName returns last price after a purchase', async () => {
    const cash = await createAccount(c, { name: 'Cash', type: 'CASH' })
    const list = await createShoppingList(c, { title: 'T' })
    const item = await addItem(c, list.id, { name: 'Rice' })
    await updateItem(c, item.id, { actualPriceMinor: 24000 })
    await setItemChecked(c, item.id, true)
    await completeListWithExpenses(c, list.id, cash.id)

    const suggestion = await suggestForName(c.spaceId, 'RICE')
    expect(suggestion?.lastPriceMinor).toBe(24000)
    expect(suggestion?.priceCount).toBe(1)
  })

  it('listPurchasesForTransaction reconstructs the item breakdown for a dashboard batch entry', async () => {
    // A Quick Add batch entry (Roadmap feedback) has no shopping list to
    // read items from — this is what the dashboard's "details" view falls
    // back to instead.
    const cash = await createAccount(c, { name: 'Cash', type: 'CASH' })
    const { recordItemizedExpense } = await import('../receipts')
    const { transaction } = await recordItemizedExpense(c, {
      accountId: cash.id,
      title: 'Sari-sari store',
      occurredAt: '2026-05-01',
      amountMinor: 15000,
      items: [
        { name: 'Rice', quantity: 2, priceMinor: 10000 },
        { name: 'Eggs', quantity: 1, priceMinor: 5000 },
      ],
    })

    const purchases = await listPurchasesForTransaction(transaction.id)
    expect(purchases).toEqual(
      expect.arrayContaining([
        { name: 'Rice', amountMinor: 10000 },
        { name: 'Eggs', amountMinor: 5000 },
      ]),
    )
    expect(purchases).toHaveLength(2)
  })

  it("listPurchasesForTransaction is empty for a plain, non-itemized transaction", async () => {
    const cash = await createAccount(c, { name: 'Cash', type: 'CASH' })
    const { recordTransaction } = await import('../money')
    const txn = await recordTransaction(c, {
      type: 'EXPENSE',
      amountMinor: 5000,
      title: 'Coffee',
      accountId: cash.id,
    })
    expect(await listPurchasesForTransaction(txn.id)).toHaveLength(0)
  })
})
