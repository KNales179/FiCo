import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, isNetworkError } from './api'

describe('api()', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('times out and throws NetworkError instead of hanging forever', async () => {
    // A dead connection doesn't always make `fetch` reject on its own —
    // wifi that's still "connected" to a router with no upstream internet
    // can leave a real request hanging far longer than this. `api()` must
    // still settle (and be recognized as a network failure, so the app
    // falls back to its offline/local data) rather than waiting on it.
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted', 'AbortError'))
          })
        })
      }),
    )

    const pending = api('/health').catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(8000)
    const error = await pending

    expect(isNetworkError(error)).toBe(true)
  })
})
