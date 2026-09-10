import { beforeEach, describe, expect, it } from 'vitest'
import { ctx, mockFetch, failFetch, withDB } from '../../test/helpers'
import { accountRepository, syncEventRepository } from '../../repositories'
import { createAccount } from '../money'
import {
  countFailedForSpace,
  countPendingForSpace,
  pull,
  pushPending,
  retryFailed,
  runSync,
} from './engine'

const c = ctx()

interface PushEvent {
  id: string
  entityType: string
  entityId: string
}

const parseEvents = (init?: RequestInit): PushEvent[] => {
  const body = JSON.parse(String(init?.body ?? '{}')) as { events?: PushEvent[] }
  return body.events ?? []
}

describe('sync engine (Phase 18/19)', () => {
  beforeEach(withDB)

  it('pushPending clears the queue and marks records SYNCED', async () => {
    const acc = await createAccount(c, { name: 'Cash', type: 'CASH' })
    expect(await countPendingForSpace(c.spaceId)).toBeGreaterThan(0)

    const restore = mockFetch((url, init) => {
      if (url.includes('/sync/push')) {
        return {
          success: true,
          results: parseEvents(init).map((e) => ({
            eventId: e.id,
            status: 'applied',
          })),
        }
      }
      throw new Error(`unexpected ${url}`)
    })

    const result = await pushPending(c)
    restore()

    expect(result.rejected).toBe(0)
    expect(result.pushed).toBeGreaterThan(0)
    expect(await syncEventRepository.listPending()).toHaveLength(0)
    expect((await accountRepository.get(acc.id))?.syncStatus).toBe('SYNCED')
  })

  it('a rejected event goes FAILED and can be retried', async () => {
    await createAccount(c, { name: 'Cash', type: 'CASH' })

    const restore = mockFetch((_url, init) => ({
      success: true,
      results: parseEvents(init).map((e) => ({
        eventId: e.id,
        status: 'rejected',
        message: 'nope',
      })),
    }))

    await pushPending(c)
    restore()

    expect(await countFailedForSpace(c.spaceId)).toBe(1)
    const requeued = await retryFailed(c.spaceId)
    expect(requeued).toBe(1)
    expect(await countPendingForSpace(c.spaceId)).toBe(1)
  })

  it('pull applies a remote record into the local store', async () => {
    const remote = {
      id: 'remote-acc-1',
      spaceId: c.spaceId,
      name: 'Remote Bank',
      type: 'BANK',
      currency: 'PHP',
      openingBalanceMinor: 0,
      status: 'ACTIVE',
      isDefault: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      version: 1,
    }
    const restore = mockFetch((url) => {
      if (url.includes('/sync/pull')) {
        return {
          success: true,
          records: [
            {
              entityType: 'account',
              clientId: remote.id,
              payload: remote,
              deletedAt: null,
            },
          ],
          cursor: '2026-01-02T00:00:00.000Z',
          hasMore: false,
        }
      }
      throw new Error(`unexpected ${url}`)
    })

    const { applied } = await pull(c)
    restore()

    expect(applied).toBe(1)
    const stored = await accountRepository.get(remote.id)
    expect(stored).toMatchObject({ name: 'Remote Bank', syncStatus: 'SYNCED' })
  })

  it('pull never clobbers a local edit that has not been pushed yet', async () => {
    const acc = await createAccount(c, { name: 'Local', type: 'CASH' })
    // acc is still syncStatus PENDING (never pushed).

    const restore = mockFetch((url) => {
      if (url.includes('/sync/pull')) {
        return {
          success: true,
          records: [
            {
              entityType: 'account',
              clientId: acc.id,
              payload: { ...acc, name: 'Server Version' },
              deletedAt: null,
            },
          ],
          cursor: '2026-01-02T00:00:00.000Z',
          hasMore: false,
        }
      }
      throw new Error(`unexpected ${url}`)
    })

    const { applied } = await pull(c)
    restore()

    expect(applied).toBe(0)
    expect((await accountRepository.get(acc.id))?.name).toBe('Local')
  })

  it('runSync reports offline when the network is down', async () => {
    await createAccount(c, { name: 'Cash', type: 'CASH' })
    const restore = failFetch()
    const outcome = await runSync(c)
    restore()
    expect(outcome).toMatchObject({ ok: false, offline: true })
  })
})
