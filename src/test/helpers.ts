import { initDB } from '../db/bootstrap'
import type { MutationContext } from '../features/sync/context'

export const ctx = (over: Partial<MutationContext> = {}): MutationContext => ({
  spaceId: 'space-1',
  userId: 'user-1',
  deviceId: 'device-1',
  ...over,
})

export const withDB = async (): Promise<void> => {
  await initDB()
}

/** Replace global fetch for one test; returns a restore fn. */
export const mockFetch = (
  handler: (url: string, init?: RequestInit) => unknown,
): (() => void) => {
  const original = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const body = handler(url, init)
    return {
      ok: true,
      status: 200,
      json: async () => body,
    } as Response
  }) as typeof fetch
  return () => {
    globalThis.fetch = original
  }
}

export const failFetch = (): (() => void) => {
  const original = globalThis.fetch
  globalThis.fetch = (async () => {
    throw new TypeError('Failed to fetch')
  }) as typeof fetch
  return () => {
    globalThis.fetch = original
  }
}
