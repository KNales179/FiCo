import { beforeEach, describe, expect, it } from 'vitest'
import { ctx, withDB } from '../../test/helpers'
import { transactionRepository } from '../../repositories'
import { createAccount, recordTransaction } from '../money'
import {
  listReconciliations,
  openReconciliationFor,
  recordCashCheck,
  resolveCashCheck,
} from './index'

const c = ctx()

describe('cash reconciliation (Phase 14)', () => {
  beforeEach(withDB)

  it('snapshots expected vs actual and keeps the gap visible', async () => {
    const cash = await createAccount(c, {
      name: 'Wallet',
      type: 'CASH',
      openingBalanceMinor: 100000,
    })
    await recordTransaction(c, {
      type: 'EXPENSE',
      amountMinor: 15000,
      title: 'Snacks',
      accountId: cash.id,
    })
    // Derived balance is now 85,000. Person counts 82,000 in the drawer.
    const txnCountBefore = (
      await transactionRepository.getAllByIndex('by-spaceId', c.spaceId)
    ).length

    const rec = await recordCashCheck(c, {
      accountId: cash.id,
      actualMinor: 82000,
      note: 'short',
    })

    expect(rec.expectedMinor).toBe(85000)
    expect(rec.actualMinor).toBe(82000)
    expect(rec.differenceMinor).toBe(-3000)
    expect(rec.status).toBe('OPEN')

    // A reconciliation never invents a transaction to close the gap.
    const txnCountAfter = (
      await transactionRepository.getAllByIndex('by-spaceId', c.spaceId)
    ).length
    expect(txnCountAfter).toBe(txnCountBefore)

    expect(await openReconciliationFor(cash.id)).toMatchObject({ id: rec.id })
  })

  it('resolving closes the open reconciliation', async () => {
    const cash = await createAccount(c, { name: 'Wallet', type: 'CASH' })
    const rec = await recordCashCheck(c, {
      accountId: cash.id,
      actualMinor: 0,
    })
    await resolveCashCheck(c, rec.id, 'counted again, all good')

    expect(await openReconciliationFor(cash.id)).toBeUndefined()
    const all = await listReconciliations(c.spaceId)
    expect(all).toHaveLength(1)
    expect(all[0].status).toBe('RESOLVED')
    expect(all[0].resolvedNote).toBe('counted again, all good')
  })

  it('rejects a check against an unknown account', async () => {
    await expect(
      recordCashCheck(c, { accountId: 'nope', actualMinor: 100 }),
    ).rejects.toThrow(/not found/i)
  })
})
