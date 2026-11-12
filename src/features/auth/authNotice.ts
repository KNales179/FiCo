/**
 * Why this device was signed out (or can't sign in), when an admin is the
 * reason: signed out, restricted for a while, account deleted, password or
 * 2FA reset. Kept in localStorage until the person has read it on the
 * sign-in screen.
 */
export interface AuthNotice {
  code: string
  message: string
  reason: string | null
  /** ISO end of a restriction; null = until lifted (or not a restriction). */
  until: string | null
  at: string
}

const KEY = 'fico.authNotice'
export const AUTH_NOTICE_EVENT = 'fico:auth-notice'

export const saveAuthNotice = (notice: AuthNotice) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(notice))
  } catch {
    // Storage blocked — the sign-in error message still says it.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUTH_NOTICE_EVENT))
}

export const loadAuthNotice = (): AuthNotice | null => {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as AuthNotice) : null
  } catch {
    return null
  }
}

export const clearAuthNotice = () => {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

/** "for 3 days, until Fri, Nov 20, 3:00 PM" / "until an admin lifts it". */
export const describeUntil = (until: string | null, now = new Date()): string => {
  if (!until) return 'until the Fico Admin Team lifts it'
  const end = new Date(until)
  const hours = Math.max(1, Math.round((end.getTime() - now.getTime()) / 3_600_000))
  const span = hours < 48 ? `${hours} hour${hours === 1 ? '' : 's'}` : `${Math.round(hours / 24)} days`
  const when = end.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  return `for about ${span} — until ${when}`
}
