import { beforeEach, describe, expect, it } from 'vitest'
import { ctx, withDB } from '../../test/helpers'
import { transactionRepository } from '../../repositories'
import type { Transaction } from '../../types/models'
import { createAccount } from './accounts'
import { computeSpaceBalances } from './balances'
import { listTransactions } from './transactions'

const c = ctx()

/** Seed `count` expense transactions with strictly increasing `occurredAt`. */
const seed = async (accountId: string, count: number) => {
  const base = Date.parse('2020-01-01T00:00:00.000Z')
  const rows: Transaction[] = Array.from({ length: count }, (_, i) => ({
    id: `txn-${String(i).padStart(6, '0')}`,
    spaceId: c.spaceId,
    type: 'EXPENSE',
    amountMinor: 100,
    currency: 'PHP',
    title: `txn ${i}`,
    categoryId: null,
    categoryName: null,
    accountId,
    destinationAccountId: null,
    occurredAt: new Date(base + i * 60_000).toISOString(),
    sourceType: 'MANUAL',
    sourceId: null,
    visibility: 'SPACE',
    createdBy: c.userId,
    createdAt: new Date(base + i * 60_000).toISOString(),
    updatedAt: new Date(base + i * 60_000).toISOString(),
    deletedAt: null,
    syncStatus: 'SYNCED',
    version: 1,
  }))
  await transactionRepository.bulkPut(rows)
}

describe('performance — large transaction history (Phase 26)', () => {
  beforeEach(withDB)

  it('listTransactions(limit) returns the newest rows without scanning them all', async () => {
    const cash = await createAccount(c, {
      name: 'Cash',
      type: 'CASH',
      openingBalanceMinor: 1_000_000,
    })
    await seed(cash.id, 5_000)

    const start = performance.now()
    const recent = await listTransactions(c.spaceId, { limit: 50 })
    const elapsed = performance.now() - start

    expect(recent).toHaveLength(50)
    // Newest first — the account's own starting-balance transaction (dated
    // "now", ahead of every 2020-dated seed row) is newer than all of them.
    expect(recent[0].title).toBe('Starting balance')
    expect(recent[1].title).toBe('txn 4999')
    expect(recent[49].title).toBe('txn 4951')
    for (let i = 1; i < recent.length; i += 1) {
      expect(recent[i - 1].occurredAt >= recent[i].occurredAt).toBe(true)
    }
    // A bounded cursor over 5k rows should be well under a tenth of a second
    // even on CI; a full scan + sort would be far slower.
    expect(elapsed).toBeLessThan(250)
  })

  it('the `before` cursor pages backwards correctly', async () => {
    const cash = await createAccount(c, { name: 'Cash', type: 'CASH' })
    await seed(cash.id, 500)

    const firstPage = await listTransactions(c.spaceId, { limit: 20 })
    const secondPage = await listTransactions(c.spaceId, {
      limit: 20,
      before: firstPage[firstPage.length - 1].occurredAt,
    })

    expect(secondPage).toHaveLength(20)
    expect(secondPage[0].title).toBe('txn 479')
    // No overlap with the first page.
    const firstIds = new Set(firstPage.map((t) => t.id))
    expect(secondPage.some((t) => firstIds.has(t.id))).toBe(false)
  })

  it('balances stay correct at scale', async () => {
    const cash = await createAccount(c, {
      name: 'Cash',
      type: 'CASH',
      openingBalanceMinor: 1_000_000,
    })
    await seed(cash.id, 5_000)

    const { accounts } = await computeSpaceBalances(c.spaceId)
    // 1,000,000 opening − 5,000 × 100 in expenses.
    expect(accounts[0].balanceMinor).toBe(1_000_000 - 5_000 * 100)
  })
})
