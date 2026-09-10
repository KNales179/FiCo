import { beforeEach, describe, expect, it } from 'vitest'
import { ctx, failFetch, mockFetch, withDB } from '../../test/helpers'
import { accountRepository, syncEventRepository } from '../../repositories'
import {
  createAccount,
  recordTransaction,
  deleteTransaction,
} from '../money'
import { addItem, createShoppingList, setItemChecked } from '../shopping'
import { createBill } from '../bills'
import { countPendingForSpace, runSync } from './engine'

const c = ctx()

interface ServerEvent {
  entityType: string
  entityId: string
  operation: string
}

/**
 * Roadmap Phase 24 — make changes offline, reconnect, sync once, and the
 * server ends up with every change exactly once.
 */
describe('reconnection (Phase 24)', () => {
  beforeEach(withDB)

  it('drains ~10 offline changes on reconnect with no duplicates or gaps', async () => {
    const restoreOffline = failFetch()

    const bank = await createAccount(c, { name: 'Bank', type: 'BANK' })
    const cash = await createAccount(c, {
      name: 'Cash',
      type: 'CASH',
      openingBalanceMinor: 100000,
    })
    const t1 = await recordTransaction(c, {
      type: 'INCOME',
      amountMinor: 300000,
      title: 'Salary',
      accountId: bank.id,
    })
    await recordTransaction(c, {
      type: 'EXPENSE',
      amountMinor: 4500,
      title: 'Coffee',
      accountId: cash.id,
    })
    await recordTransaction(c, {
      type: 'TRANSFER',
      amountMinor: 50000,
      title: 'ATM',
      accountId: bank.id,
      destinationAccountId: cash.id,
    })
    await deleteTransaction(c, t1.id)
    const list = await createShoppingList(c, { title: 'Trip' })
    const item = await addItem(c, list.id, { name: 'Rice' })
    await setItemChecked(c, item.id, true)
    await createBill(c, {
      name: 'Water',
      recurrence: 'MONTHLY',
      billType: 'VARIABLE',
      nextDueDate: '2026-05-01T00:00:00.000Z',
    })

    restoreOffline()

    const pendingBefore = await countPendingForSpace(c.spaceId)
    expect(pendingBefore).toBeGreaterThanOrEqual(10)

    const server: ServerEvent[] = []
    const restore = mockFetch((url, init) => {
      if (url.includes('/sync/push')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          events: Array<ServerEvent & { id: string }>
        }
        for (const e of body.events) {
          server.push({
            entityType: e.entityType,
            entityId: e.entityId,
            operation: e.operation,
          })
        }
        return {
          success: true,
          results: body.events.map((e) => ({
            eventId: e.id,
            status: 'applied',
          })),
        }
      }
      if (url.includes('/sync/pull')) {
        return { success: true, records: [], cursor: '', hasMore: false }
      }
      throw new Error(`unexpected ${url}`)
    })

    const outcome = await runSync(c)
    expect(outcome.ok).toBe(true)
    expect(outcome.rejected).toBe(0)
    expect(outcome.pushed).toBe(pendingBefore)

    // Every offline change reached the server...
    expect(server.length).toBe(pendingBefore)
    // ...exactly once.
    const keys = server.map((e) => `${e.entityType}:${e.entityId}:${e.operation}`)
    expect(new Set(keys).size).toBe(keys.length)

    // Local queue is empty and records are marked synced.
    expect(await syncEventRepository.listPending()).toHaveLength(0)
    expect((await accountRepository.get(bank.id))?.syncStatus).toBe('SYNCED')

    // A second sync with nothing pending is a no-op.
    const again = await runSync(c)
    restore()
    expect(again.pushed).toBe(0)
    expect(server.length).toBe(pendingBefore)
  })
})
