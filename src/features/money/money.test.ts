import { beforeEach, describe, expect, it } from 'vitest'
import { ctx, withDB } from '../../test/helpers'
import { syncEventRepository } from '../../repositories'
import {
  computeSpaceBalances,
  createAccount,
  deleteTransaction,
  listTransactions,
  recordTransaction,
  resolveDefaultAccount,
  setDefaultAccount,
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
