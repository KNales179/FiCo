import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, isNetworkError } from './api'

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

  const respond = (status: number, body: string) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body, { status, headers: { 'Content-Type': body.startsWith('{') ? 'application/json' : 'text/html' } })),
    )

  it('treats a host error page (server waking up, Wi-Fi login page) as offline', async () => {
    respond(502, '<html><body>Bad gateway</body></html>')
    const error = await api('/spaces').catch((e: unknown) => e)
    expect(isNetworkError(error)).toBe(true)
  })

  it('still reports the server’s own 5xx answer as an error with its message', async () => {
    respond(503, JSON.stringify({ success: false, message: "Google sign-in isn't set up on this server yet" }))
    const error = await api('/auth/google').catch((e: unknown) => e)
    expect(isNetworkError(error)).toBe(false)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(503)
    expect((error as ApiError).message).toBe("Google sign-in isn't set up on this server yet")
  })

  it('leaves a 4xx answer alone, even without a JSON body', async () => {
    respond(404, 'Not found')
    const error = await api('/nope').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(404)
  })
})
