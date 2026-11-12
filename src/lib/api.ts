import { isDemoMode } from '../features/demo/demoMode'
import { saveAuthNotice, type AuthNotice } from '../features/auth/authNotice'
export const API_URL =
  import.meta.env?.VITE_API_URL || 'http://localhost:5000/api'

/**
 * Is the Fico API actually answering? Used to tell "this device has no network"
 * apart from "the server is down / misconfigured", since `navigator.onLine`
 * can't. Never throws.
 */
export const probeServer = async (timeoutMs = 4000): Promise<boolean> => {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const response = await fetch(`${API_URL}/health`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    })
    clearTimeout(timer)
    return response.ok
  } catch {
    return false
  }
}

interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  /** Overrides the default timeout for just this call — see `getMe`'s use
   *  of this for the cold-start case below. */
  timeoutMs?: number
}

/** Error thrown for any request that reached the server and came back not-ok. */
export class ApiError extends Error {
  status: number
  /** Per-field reasons from the server (e.g. { username: ['That username is taken'] }). */
  fieldErrors?: Record<string, string[]>
  /** A machine-readable reason when the server gives one (e.g. 'TERMS_REQUIRED'). */
  code?: string
  /** Why an admin ended this session / blocked this account, when that's the reason. */
  notice?: AuthNotice

  constructor(
    message: string,
    status: number,
    fieldErrors?: Record<string, string[]>,
    code?: string,
    notice?: AuthNotice,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
    this.code = code
    this.notice = notice
  }
}

/** Error thrown when the request never reached the server (offline, DNS, CORS, …). */
export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super('Could not reach the server')
    this.name = 'NetworkError'
    this.cause = cause
  }
}

export const isNetworkError = (error: unknown): error is NetworkError =>
  error instanceof NetworkError

/**
 * A dead connection doesn't always make `fetch` reject quickly — wifi that's
 * still "connected" to a router with no upstream internet, in particular,
 * can leave a request hanging well past when the app should have already
 * fallen back to offline mode. Aborting after this long guarantees `api()`
 * always settles one way or the other in reasonable time.
 *
 * This is deliberately short enough that an *interactive* action (tapping
 * Save while genuinely offline) fails fast rather than hanging — it is not
 * meant to be patient enough for a free-tier host's cold start (Render's
 * free plan can take 20-50s to wake a sleeping instance). `getMe`'s very
 * first call at app boot passes its own longer `timeoutMs` for exactly
 * that reason; every other call keeps this default.
 */
const REQUEST_TIMEOUT_MS = 8000

/**
 * Patient enough to survive a free-tier host waking a sleeping instance
 * (Render's free plan can take 20-50s) — used only where that's actually
 * plausible and there's nothing local to fall back on: the check at app
 * boot, reconnecting, and signing in or registering (a brand-new device has
 * no cached session, so giving up after 8s just makes someone tap "Sign in"
 * again and again while the server is still starting). Everything else
 * keeps the short default so an ordinary action while genuinely offline
 * still fails fast.
 */
export const COLD_START_TIMEOUT_MS = 45_000

export const api = async <T>(
  endpoint: string,
  options: ApiOptions = {},
): Promise<T> => {
  const { body, headers, signal, timeoutMs, ...rest } = options

  // Demo mode is a pretend, device-only account: never reach the real
  // server — answer as if offline, and the app runs on local data.
  if (isDemoMode()) throw new NetworkError(new Error('Demo mode'))

  let response: Response

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs ?? REQUEST_TIMEOUT_MS)
  // Respect a caller-provided signal too, so a component that wants to
  // cancel its own request (unmounted, superseded by a newer one) still can.
  signal?.addEventListener('abort', () => controller.abort())

  // A FormData body (file upload) must go through as-is, with no
  // Content-Type set — the browser fills in the multipart boundary itself.
  // Everything else keeps going through as JSON, as before.
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData

  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...rest,

      credentials: 'include',
      signal: controller.signal,

      headers: isFormData
        ? { ...headers }
        : {
            'Content-Type': 'application/json',
            ...headers,
          },

      body: isFormData
        ? (body as FormData)
        : body !== undefined
          ? JSON.stringify(body)
          : undefined,
    })
  } catch (cause) {
    // fetch only rejects when the request could not be made at all (this
    // includes our own timeout abort).
    throw new NetworkError(cause)
  } finally {
    clearTimeout(timer)
  }

  type ErrorBody = {
    message?: string
    errors?: Record<string, string[]>
    code?: string
    notice?: Omit<AuthNotice, 'message'>
  }
  let data: ErrorBody | null = null

  try {
    data = (await response.json()) as ErrorBody
  } catch {
    // Response has no JSON body.
  }

  if (!response.ok) {
    const notice = data?.notice ? { ...data.notice, message: data.message || '' } : undefined
    // Signed out / restricted / deleted by an admin: remember why, so the
    // sign-in screen can say so — whichever request happened to find out.
    if (notice) saveAuthNotice(notice)
    throw new ApiError(
      data?.message || 'Something went wrong',
      response.status,
      data?.errors,
      data?.code,
      notice,
    )
  }

  return data as unknown as T
}
