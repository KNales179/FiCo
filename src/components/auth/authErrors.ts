import { ApiError, isNetworkError } from '../../lib/api'

/**
 * Turns a failed sign-in / sign-up into something a person can act on. The
 * most common "it just doesn't work" is the free server still waking up —
 * say so, instead of a bare "could not reach the server".
 */
export const friendlyAuthError = (error: unknown, fallback: string): string => {
  if (isNetworkError(error)) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return "You're offline — connect to the internet to sign in or create an account."
    }
    return "Fico's server didn't answer in time. It naps when nobody's using it and takes up to a minute to wake up — please try again in a moment."
  }
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return 'Too many tries in a short time — wait a few minutes, then try again.'
    }
    if (error.status >= 500 && error.status !== 503) {
      return 'Something went wrong on our side — please try again in a moment.'
    }
    return error.message || fallback
  }
  return error instanceof Error && error.message ? error.message : fallback
}
