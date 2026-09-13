import { beforeEach, describe, expect, it } from 'vitest'
import { ctx, withDB } from '../../test/helpers'
import {
  accountRepository,
  syncEventRepository,
  transactionRepository,
} from '../../repositories'
import {
  backfillOpeningBalances,
  computeSpaceBalances,
  createAccount,
  deleteTransaction,
  listTransactions,
  recordTransaction,
  resolveDefaultAccount,
  setDefaultAccount,
  updateTransaction,
} from './index'

const c = ctx()

describe('money engine (Roadmap Phase 6 integrity)', () => {
  beforeEach(withDB)

  it('income increases, expense decreases, transfer moves between accounts', async () => {
    const cash = await createAccount(c, {
      name: 'Cash',
      type: 'CASH',
      openingBalanceMinor: 100000,
    })
    const bank = await createAccount(c, {
      name: 'Bank',
      type: 'BANK',
      openingBalanceMinor: 0,
    })

    await recordTransaction(c, {
      type: 'INCOME',
      amountMinor: 1000000,
      title: 'Salary',
      accountId: bank.id,
    })
    await recordTransaction(c, {
      type: 'EXPENSE',
      amountMinor: 50000,
      title: 'Groceries',
      accountId: cash.id,
    })
    await recordTransaction(c, {
      type: 'TRANSFER',
      amountMinor: 100000,
      title: 'ATM',
      accountId: bank.id,
      destinationAccountId: cash.id,
    })

    const { accounts, totalsByCurrency } = await computeSpaceBalances(
      c.spaceId,
    )
    const byName = Object.fromEntries(
      accounts.map((a) => [a.name, a.balanceMinor]),
    )

    expect(byName.Bank).toBe(900000) // 1,000,000 − 100,000 transfer out
    expect(byName.Cash).toBe(150000) // 100,000 − 50,000 + 100,000 transfer in
    // The critical invariant: a transfer never changes the space total.
    expect(totalsByCurrency.PHP).toBe(1050000)
  })

  it('a cross-currency transfer credits the converted amount, in the destination currency', async () => {
    const aed = await createAccount(c, {
      name: "Mom's AED account",
      type: 'BANK',
      currency: 'AED',
      openingBalanceMinor: 500000, // AED 5,000.00
    })
    const php = await createAccount(c, {
      name: 'My PHP account',
      type: 'BANK',
      currency: 'PHP',
      openingBalanceMinor: 0,
    })

    await recordTransaction(c, {
      type: 'TRANSFER',
      amountMinor: 100000, // AED 1,000.00 sent
      title: 'Mom sent money',
      accountId: aed.id,
      destinationAccountId: php.id,
      destinationAmountMinor: 1800000, // PHP 18,000.00 landed
      exchangeRate: 18,
    })

    const { accounts, totalsByCurrency } = await computeSpaceBalances(
      c.spaceId,
    )
    const byName = Object.fromEntries(
      accounts.map((a) => [a.name, a.balanceMinor]),
    )

    expect(byName["Mom's AED account"]).toBe(400000) // 5,000 − 1,000 AED
    expect(byName['My PHP account']).toBe(1800000) // +18,000 PHP, not +1,000
    // Each currency keeps its own total — a transfer never blends them.
    expect(totalsByCurrency.AED).toBe(400000)
    expect(totalsByCurrency.PHP).toBe(1800000)
  })

  it('a transfer is not counted as an expense', async () => {
    const a = await createAccount(c, { name: 'A', type: 'CASH' })
    const b = await createAccount(c, { name: 'B', type: 'BANK' })
    await recordTransaction(c, {
      type: 'EXPENSE',
      amountMinor: 30000,
      title: 'Real expense',
      accountId: a.id,
    })
    await recordTransaction(c, {
      type: 'TRANSFER',
      amountMinor: 500000,
      title: 'Move money',
      accountId: a.id,
      destinationAccountId: b.id,
    })

    const expenses = await listTransactions(c.spaceId, { type: 'EXPENSE' })
    expect(expenses).toHaveLength(1)
    expect(expenses[0].title).toBe('Real expense')
  })

  it('rejects bad amounts and malformed transfers', async () => {
    const a = await createAccount(c, { name: 'A', type: 'CASH' })
    const b = await createAccount(c, { name: 'B', type: 'BANK' })

    await expect(
      recordTransaction(c, {
        type: 'EXPENSE',
        amountMinor: 0,
        title: 'x',
        accountId: a.id,
      }),
    ).rejects.toThrow()
    await expect(
      recordTransaction(c, {
        type: 'EXPENSE',
        amountMinor: -5,
        title: 'x',
        accountId: a.id,
      }),
    ).rejects.toThrow()
    await expect(
      recordTransaction(c, {
        type: 'TRANSFER',
        amountMinor: 100,
        title: 'x',
        accountId: a.id,
        destinationAccountId: a.id,
      }),
    ).rejects.toThrow()
    await expect(
      recordTransaction(c, {
        type: 'TRANSFER',
        amountMinor: 100,
        title: 'x',
        accountId: a.id,
      }),
    ).rejects.toThrow()
    await expect(
      recordTransaction(c, {
        type: 'EXPENSE',
        amountMinor: 100,
        title: 'x',
        accountId: 'nope',
      }),
    ).rejects.toThrow()

    void b
  })

  it('soft-deleting a transaction reverts its balance effect', async () => {
    const cash = await createAccount(c, {
      name: 'Cash',
      type: 'CASH',
      openingBalanceMinor: 100000,
    })
    const txn = await recordTransaction(c, {
      type: 'EXPENSE',
      amountMinor: 25000,
      title: 'Coffee',
      accountId: cash.id,
    })

    let bal = await computeSpaceBalances(c.spaceId)
    expect(bal.accounts[0].balanceMinor).toBe(75000)

    await deleteTransaction(c, txn.id)
    bal = await computeSpaceBalances(c.spaceId)
    expect(bal.accounts[0].balanceMinor).toBe(100000)
  })

  it('editing a transaction corrects the name, amount, and category — balance follows the new amount', async () => {
    const cash = await createAccount(c, {
      name: 'Cash',
      type: 'CASH',
      openingBalanceMinor: 100000,
    })
    const txn = await recordTransaction(c, {
      type: 'EXPENSE',
      amountMinor: 5000,
      title: 'Coffee',
      accountId: cash.id,
    })

    const edited = await updateTransaction(c, txn.id, {
      title: 'Coffee and pastry',
      amountMinor: 8000,
      categoryId: 'cat-1',
      categoryName: 'Food',
      occurredAt: '2026-03-01T00:00:00.000Z',
    })
    expect(edited.occurredAt).toBe('2026-03-01T00:00:00.000Z')
    expect(edited).toMatchObject({
      title: 'Coffee and pastry',
      amountMinor: 8000,
      categoryId: 'cat-1',
      categoryName: 'Food',
    })

    const bal = await computeSpaceBalances(c.spaceId)
    expect(bal.accounts[0].balanceMinor).toBe(92000) // 100,000 − 8,000, not the original 5,000
  })

  it('editing a transaction to a different account moves its balance effect there', async () => {
    const cash = await createAccount(c, {
      name: 'Cash',
      type: 'CASH',
      openingBalanceMinor: 100000,
    })
    const bank = await createAccount(c, {
      name: 'Bank',
      type: 'BANK',
      openingBalanceMinor: 200000,
    })
    const txn = await recordTransaction(c, {
      type: 'EXPENSE',
      amountMinor: 10000,
      title: 'Groceries',
      accountId: cash.id,
    })

    await updateTransaction(c, txn.id, { accountId: bank.id })

    const bal = await computeSpaceBalances(c.spaceId)
    const byId = Object.fromEntries(bal.accounts.map((a) => [a.id, a.balanceMinor]))
    expect(byId[cash.id]).toBe(100000) // no longer charged here
    expect(byId[bank.id]).toBe(190000) // charged here instead
  })

  it('refuses an edit that would make the transaction invalid', async () => {
    const cash = await createAccount(c, { name: 'Cash', type: 'CASH' })
    const txn = await recordTransaction(c, {
      type: 'EXPENSE',
      amountMinor: 5000,
      title: 'Coffee',
      accountId: cash.id,
    })

    await expect(
      updateTransaction(c, txn.id, { amountMinor: 0 }),
    ).rejects.toThrow(/greater than zero/i)
    await expect(
      updateTransaction(c, txn.id, { accountId: 'nope' }),
    ).rejects.toThrow(/choose an account/i)
  })

  it('every mutation queues a sync event', async () => {
    const cash = await createAccount(c, { name: 'Cash', type: 'CASH' })
    await recordTransaction(c, {
      type: 'INCOME',
      amountMinor: 1000,
      title: 'x',
      accountId: cash.id,
    })
    const pending = await syncEventRepository.listPending()
    const ops = pending.map((e) => `${e.operation}:${e.entityType}`)
    expect(ops).toContain('CREATE:account')
    expect(ops).toContain('CREATE:transaction')
  })

  it('a starting balance is real income, not a hidden field — shows up, is counted once', async () => {
    const cash = await createAccount(c, {
      name: 'Cash',
      type: 'CASH',
      openingBalanceMinor: 500000,
    })

    // Not silently baked into the account record...
    expect(cash.openingBalanceMinor).toBe(0)

    // ...it's an actual, visible INCOME transaction instead.
    const txns = await listTransactions(c.spaceId, { type: 'INCOME' })
    expect(txns).toHaveLength(1)
    expect(txns[0]).toMatchObject({
      title: 'Starting balance',
      amountMinor: 500000,
      accountId: cash.id,
      sourceType: 'OPENING_BALANCE',
    })

    // And the balance is the same either way — counted once, not twice.
    const bal = await computeSpaceBalances(c.spaceId)
    expect(bal.accounts[0].balanceMinor).toBe(500000)
  })

  it('no starting-balance transaction is created when there is nothing to start with', async () => {
    await createAccount(c, { name: 'Cash', type: 'CASH' })
    await createAccount(c, {
      name: 'Bank',
      type: 'BANK',
      openingBalanceMinor: 0,
    })
    expect(await listTransactions(c.spaceId, { type: 'INCOME' })).toHaveLength(0)
  })

  it('backfillOpeningBalances catches an older account up, once, without double-counting', async () => {
    // Simulate an account created before a starting balance became a real
    // transaction — the stored field is set directly, bypassing createAccount.
    const old = await accountRepository.create({
      spaceId: c.spaceId,
      name: 'Bank',
      type: 'BANK',
      currency: 'PHP',
      openingBalanceMinor: 2000000,
      status: 'ACTIVE',
      isDefault: true,
      syncStatus: 'SYNCED',
      version: 1,
    })

    await backfillOpeningBalances(c)

    const txns = await listTransactions(c.spaceId, { type: 'INCOME' })
    expect(txns).toHaveLength(1)
    expect(txns[0]).toMatchObject({
      title: 'Starting balance',
      amountMinor: 2000000,
      accountId: old.id,
      sourceType: 'OPENING_BALANCE',
    })

    const refreshed = await accountRepository.get(old.id)
    expect(refreshed?.openingBalanceMinor).toBe(0)

    const bal = await computeSpaceBalances(c.spaceId)
    expect(bal.accounts[0].balanceMinor).toBe(2000000)

    // Running it again must not create a second transaction.
    await backfillOpeningBalances(c)
    expect(await listTransactions(c.spaceId, { type: 'INCOME' })).toHaveLength(1)
  })

  it('same-day transactions tie-break by when they were actually entered, not arbitrarily', async () => {
    // Both dated the same day (no time-of-day, as a manually-typed entry
    // gets) — without a deterministic tiebreaker these could come back in
    // whatever order the store happens to return, which looks like the
    // list randomly reshuffled itself on an unrelated change (owner
    // feedback).
    const cash = await createAccount(c, { name: 'Cash', type: 'CASH' })
    const sameDay = '2026-09-12T00:00:00.000Z'
    const first = await recordTransaction(c, {
      type: 'EXPENSE',
      amountMinor: 1000,
      title: 'Entered first',
      accountId: cash.id,
      occurredAt: sameDay,
    })
    const second = await recordTransaction(c, {
      type: 'EXPENSE',
      amountMinor: 2000,
      title: 'Entered second',
      accountId: cash.id,
      occurredAt: sameDay,
    })
    // Force a real, distinct createdAt on each — `update()` (rightly)
    // refuses to change it, so write it directly.
    await transactionRepository.put({
      ...(await transactionRepository.get(first.id))!,
      createdAt: '2026-09-12T08:00:00.000Z',
    })
    await transactionRepository.put({
      ...(await transactionRepository.get(second.id))!,
      createdAt: '2026-09-12T09:00:00.000Z',
    })

    const all = await listTransactions(c.spaceId, { type: 'EXPENSE' })
    expect(all.map((t) => t.title)).toEqual(['Entered second', 'Entered first'])

    const recent = await listTransactions(c.spaceId, {
      type: 'EXPENSE',
      limit: 10,
    })
    expect(recent.map((t) => t.title)).toEqual(['Entered second', 'Entered first'])
  })

  it('first account is default; setDefaultAccount is exclusive', async () => {
    const bank = await createAccount(c, { name: 'Bank', type: 'BANK' })
    const cash = await createAccount(c, { name: 'Cash', type: 'CASH' })
    expect(bank.isDefault).toBe(true)
    expect(cash.isDefault).toBe(false)

    await setDefaultAccount(c, cash.id)
    const bal = await computeSpaceBalances(c.spaceId)
    expect(resolveDefaultAccount(bal.accounts)?.name).toBe('Cash')
    expect(bal.accounts.filter((a) => a.isDefault)).toHaveLength(1)
  })
})
