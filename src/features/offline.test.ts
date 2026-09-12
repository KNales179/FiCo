import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ctx, failFetch, withDB } from '../test/helpers'
import { syncEventRepository } from '../repositories'
import {
  computeSpaceBalances,
  createAccount,
  listTransactions,
  recordTransaction,
} from './money'
import {
  addItem,
  createShoppingList,
  listItems,
  setItemChecked,
  updateItem,
} from './shopping'
import { completeListWithExpenses } from './shopping/complete'
import { createBill, listBills, payBill } from './bills'
import {
  clearLocalAuth,
  ensureDeviceId,
  loadLocalAuth,
  persistLocalAuth,
  wasSignedOut,
} from './auth/localAuth'

const c = ctx()

/**
 * Roadmap Phase 23 — every core workflow must complete with no network at all.
 * `failFetch()` makes any accidental request throw, so a passing test proves
 * the path is genuinely local-first.
 */
describe('offline operation (Phase 23)', () => {
  let restoreFetch: () => void

  beforeEach(async () => {
    await withDB()
    restoreFetch = failFetch()
  })
  afterEach(() => restoreFetch())

  it('records income, expense and transfer, and derives balances offline', async () => {
    const bank = await createAccount(c, {
      name: 'Bank',
      type: 'BANK',
      openingBalanceMinor: 0,
    })
    const cash = await createAccount(c, {
      name: 'Cash',
      type: 'CASH',
      openingBalanceMinor: 0,
    })

    await recordTransaction(c, {
      type: 'INCOME',
      amountMinor: 500000,
      title: 'Salary',
      accountId: bank.id,
    })
    await recordTransaction(c, {
      type: 'EXPENSE',
      amountMinor: 20000,
      title: 'Lunch',
      accountId: cash.id,
    })
    await recordTransaction(c, {
      type: 'TRANSFER',
      amountMinor: 100000,
      title: 'ATM',
      accountId: bank.id,
      destinationAccountId: cash.id,
    })

    const { accounts, totalsByCurrency } = await computeSpaceBalances(c.spaceId)
    const byName = Object.fromEntries(
      accounts.map((a) => [a.name, a.balanceMinor]),
    )
    expect(byName.Bank).toBe(400000)
    expect(byName.Cash).toBe(80000)
    // The Phase 22 critical invariant, still true with zero connectivity.
    expect(totalsByCurrency.PHP).toBe(480000)

    const pending = await syncEventRepository.listPending()
    expect(pending.length).toBeGreaterThanOrEqual(5)
  })

  it('runs a full shopping trip offline', async () => {
    const cash = await createAccount(c, {
      name: 'Cash',
      type: 'CASH',
      openingBalanceMinor: 200000,
    })
    const list = await createShoppingList(c, {
      title: 'Groceries',
      plannedBudgetMinor: 150000,
    })
    const rice = await addItem(c, list.id, { name: 'Rice' })
    await addItem(c, list.id, { name: 'Eggs', addedDuringTrip: true })
    await setItemChecked(c, rice.id, true)
    await updateItem(c, rice.id, { actualPriceMinor: 45000 })

    expect(await listItems(list.id)).toHaveLength(2)

    const result = await completeListWithExpenses(c, list.id, cash.id)
    expect(result).toEqual({ createdCount: 1, itemCount: 1, spentMinor: 45000 })

    const bal = await computeSpaceBalances(c.spaceId)
    expect(bal.accounts[0].balanceMinor).toBe(155000)
  })

  it('reads cached bills and confirms a payment offline', async () => {
    const cash = await createAccount(c, { name: 'Cash', type: 'CASH' })
    await createBill(c, {
      name: 'Rent',
      recurrence: 'MONTHLY',
      billType: 'FIXED',
      nextDueDate: '2026-04-01T00:00:00.000Z',
    })

    const bills = await listBills(c.spaceId)
    expect(bills).toHaveLength(1)

    const { payment } = await payBill(c, bills[0].id, {
      amountMinor: 1200000,
      accountId: cash.id,
    })
    expect(payment.amountMinor).toBe(1200000)

    const expenses = await listTransactions(c.spaceId, { type: 'EXPENSE' })
    expect(expenses).toHaveLength(1)
  })

  it('an already-authenticated device opens offline; a fresh device cannot', async () => {
    await persistLocalAuth(
      {
        id: 'user-1',
        username: 'ivhel',
        email: 'ivhel@example.com',
        displayName: 'Ivhel',
      },
      { expiresAt: new Date(Date.now() + 86_400_000).toISOString() },
    )

    const snapshot = await loadLocalAuth()
    expect(snapshot?.user.id).toBe('user-1')

    // Sign out (offline): the session cookie may still be valid, so the
    // explicit flag is what keeps the next startup from re-authenticating.
    await clearLocalAuth({ markSignedOut: true })
    expect(await loadLocalAuth()).toBeNull()
    expect(await wasSignedOut()).toBe(true)
  })

  it('logging out wipes this device\'s cached financial data (shared-device safety), but keeps its own device id', async () => {
    const deviceIdBefore = await ensureDeviceId()

    // Data left behind by whoever was using this device — must not still
    // be sitting in IndexedDB for the next person who signs into a
    // different account on the same browser (frontend-data-performance:
    // "clear user-specific cache on logout to prevent data leakage").
    await createAccount(c, { name: 'Cash', type: 'CASH', openingBalanceMinor: 50000 })
    await recordTransaction(c, {
      type: 'EXPENSE',
      amountMinor: 1000,
      title: 'Coffee',
      accountId: (await createAccount(c, { name: 'Bank', type: 'BANK' })).id,
    })

    await clearLocalAuth({ markSignedOut: true })

    expect(await listTransactions(c.spaceId)).toHaveLength(0)
    const { accounts } = await computeSpaceBalances(c.spaceId)
    expect(accounts).toHaveLength(0)

    // The device id is not personal data — losing it would make this
    // device look "new" to the server next time, breaking device
    // recognition for no reason.
    expect(await ensureDeviceId()).toBe(deviceIdBefore)
  })

  it('a device that never authenticated has no local session', async () => {
    expect(await loadLocalAuth()).toBeNull()
    expect(await wasSignedOut()).toBe(false)
  })
})
