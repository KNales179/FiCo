import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ctx, failFetch, withDB } from '../../test/helpers'
import { createAccount, recordTransaction } from '../money'
import { computeAnalytics } from './index'

const c = ctx()

/** fetch answers with a server error page (Render waking up, a captive Wi-Fi portal…). */
const serverErrorFetch = (status: number) => {
  const original = globalThis.fetch
  globalThis.fetch = (async () =>
    ({
      ok: false,
      status,
      headers: new Headers(),
      json: async () => {
        throw new SyntaxError('not JSON')
      },
    }) as unknown as Response) as typeof fetch
  return () => {
    globalThis.fetch = original
  }
}

const seed = async () => {
  const now = new Date()
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
  const cash = await createAccount(c, { name: 'Cash', type: 'CASH', openingBalanceMinor: 0 })
  await recordTransaction(c, { type: 'INCOME', amountMinor: 100000, title: 'Sales', accountId: cash.id, occurredAt: today })
  await recordTransaction(c, {
    type: 'INCOME',
    amountMinor: 900000,
    title: 'Secret',
    accountId: cash.id,
    occurredAt: today,
    visibility: 'PRIVATE',
  })
}

describe('analytics offline fallback', () => {
  let restore: (() => void) | null = null
  beforeEach(withDB)
  afterEach(() => {
    restore?.()
    restore = null
    vi.unstubAllGlobals()
  })

  it('uses this device’s numbers when there is no connection', async () => {
    await seed()
    restore = failFetch()
    const a = await computeAnalytics(c.spaceId, 'THIS_MONTH')
    expect(a.fromCache).toBe(true)
    expect(a.incomeMinor).toBe(100000)
  })

  it('uses this device’s numbers when the server answers with an error page', async () => {
    await seed()
    restore = serverErrorFetch(503)
    const a = await computeAnalytics(c.spaceId, 'THIS_MONTH')
    expect(a.fromCache).toBe(true)
    expect(a.incomeMinor).toBe(100000)
  })

  it('does not even try the server when the device knows it is offline', async () => {
    await seed()
    vi.stubGlobal('navigator', { onLine: false })
    const fetchSpy = vi.fn()
    const original = globalThis.fetch
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    restore = () => {
      globalThis.fetch = original
    }
    const a = await computeAnalytics(c.spaceId, 'THIS_MONTH')
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(a.fromCache).toBe(true)
  })

  it('still reports a real refusal (not a member) instead of hiding it', async () => {
    restore = serverErrorFetch(403)
    await expect(computeAnalytics(c.spaceId, 'THIS_MONTH')).rejects.toThrow()
  })
})
