import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import { ApiError, COLD_START_TIMEOUT_MS } from '../lib/api'
import { clearSnapshots } from '../features/offlineSnapshots'

/**
 * Only a real "this session is no good" answer signs the device out. A
 * free-tier host waking up answers with 502/503/504 for a while — that's
 * the server being sleepy, not the session being invalid, and treating it
 * as a rejection was logging people out of a session they were using.
 */
const isSessionRejected = (error: unknown) =>
  error instanceof ApiError && (error.status === 401 || error.status === 403)

/** While the app is open and the server answers, check in this often — every
 *  authenticated request slides the session's expiry forward. */
const KEEPALIVE_MS = 20 * 60 * 1000
import type { LocalUser } from '../types/models'
import type { SessionInfo, User } from '../types/auth'
import {
  getMe,
  login as loginRequest,
  googleAuth as googleAuthRequest,
  logout as logoutRequest,
  register as registerRequest,
  verifyTwoFactorLogin as verifyTwoFactorRequest,
} from '../services/authService'
import {
  clearLocalAuth,
  ensureDeviceId,
  prepareLocalDataFor,
  loadLocalAuth,
  persistLocalAuth,
  wasSignedOut,
} from '../features/auth/localAuth'
import { useConnectivity } from '../hooks/useConnectivity'
import { AuthContext } from './auth-context'
import { onSessionRejected } from '../features/sync/events'
import { clearNotificationCache, seedDemoNotifications } from '../features/notifications'
import { DEMO_USER_ID, enterDemoMode, isDemoMode, leaveDemoMode, loadDemoUser } from '../features/demo/demoMode'
import { markJustSignedOut } from '../features/auth/returning'
import { purgeDemoData, seedDemoData } from '../features/demo/seed'

/** The account as saved on this device (shown at once, before the server answers). */
const userFromLocal = (u: LocalUser): User => ({
  id: u.id,
  username: u.username,
  email: u.email ?? '',
  displayName: u.displayName ?? null,
  birthday: u.birthday ?? null,
  paydays: u.paydays ?? [],
  badges: u.badges ?? [],
  role: u.role,
})

const toUser = (user: User): User => ({
  id: user.id,
  username: user.username,
  email: user.email,
  displayName: user.displayName ?? null,
  birthday: user.birthday ?? null,
  paydays: user.paydays ?? [],
  badges: user.badges ?? [],
  role: user.role,
  totpEnabled: user.totpEnabled,
  emailVerified: user.emailVerified,
  avatarUrl: user.avatarUrl ?? null,
  notificationPreferences: user.notificationPreferences,
})

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)
  const { serverReachable } = useConnectivity()
  const revalidating = useRef(false)

  const applyServerAuth = useCallback(
    async (nextUser: User, session?: SessionInfo) => {
      // Another account's leftovers on this device are cleared first; this
      // account's own kept (unsynced) changes stay and get sent up.
      await prepareLocalDataFor(nextUser.id)
      setUser(toUser(nextUser))
      setOffline(false)
      await persistLocalAuth(nextUser, session)
    },
    [],
  )

  /**
   * The server ended this session (expired, revoked…): sign out, but keep
   * any changes this device never got to send — they're the person's work,
   * and they sync as soon as that person signs back in. Only an explicit
   * "Log out" (which warns first) clears them.
   */
  const dropAuth = useCallback(
    async (options?: { markSignedOut?: boolean; keepUnsynced?: boolean }) => {
      await clearLocalAuth({ keepUnsynced: true, ...options })
      clearNotificationCache()
      markJustSignedOut()
      setUser(null)
      setOffline(false)
    },
    [],
  )

  // Startup: prefer the server, fall back to a stored local session when offline.
  useEffect(() => {
    let cancelled = false

    const restore = async () => {
      // The demo account never talks to the server — just open it.
      if (isDemoMode()) {
        setUser(loadDemoUser())
        setLoading(false)
        return
      }

      // Honour an explicit sign-out even if the server cookie is still valid.
      if (await wasSignedOut()) {
        if (cancelled) return
        void logoutRequest().catch(() => {
          // Best effort: revoke the lingering server session when possible.
        })
        setUser(null)
        setLoading(false)
        return
      }

      // Local-first boot (Architecture: "usable offline without ever
      // requiring a fresh login"): if this device has signed in before,
      // open with that cached session right away — the app must never sit
      // blocked behind a server round trip just to show data that's
      // already sitting in IndexedDB, and a free-tier host waking a
      // sleeping instance can easily take 20-50s. The server is still
      // asked to reconcile below, just without the UI waiting on it.
      const local = await loadLocalAuth()
      if (cancelled) return
      if (local) {
        setUser(userFromLocal(local.user))
        setOffline(true) // optimistic — applyServerAuth below clears it once confirmed
        setLoading(false)
      }

      try {
        const response = await getMe(COLD_START_TIMEOUT_MS)
        if (cancelled) return
        await applyServerAuth(response.user, response.session)
      } catch (error) {
        if (cancelled) return

        if (isSessionRejected(error)) {
          // The server rejected the session — this device is no longer trusted.
          // (Nobody was signed in here at all? Then there's nothing to drop,
          // and they're a visitor, not someone who was just signed out.)
          if (local) await dropAuth()
          else setUser(null)
        } else if (!local) {
          // Unreachable or sleepy server and nothing cached to run on.
          setUser(null)
        }
        // Otherwise: keep running on the cached local session.
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void restore()

    return () => {
      cancelled = true
    }
  }, [applyServerAuth, dropAuth])

  // Running on the cached local session, and the server has now actually
  // answered (not just "the device has a network") — re-confirm with it.
  // Keyed on the server answering rather than on `navigator.onLine`, since a
  // sleeping backend leaves the device "online" the whole time it wakes up.
  useEffect(() => {
    if (serverReachable !== true || !offline || !user || revalidating.current) return
    if (isDemoMode()) return

    revalidating.current = true
    void getMe(COLD_START_TIMEOUT_MS)
      .then((response) => applyServerAuth(response.user, response.session))
      .catch(async (error) => {
        if (isSessionRejected(error)) {
          await dropAuth()
        }
      })
      .finally(() => {
        revalidating.current = false
      })
  }, [serverReachable, offline, user, applyServerAuth, dropAuth])

  // A sync found the server no longer accepts this session — sign out now
  // (keeping any unsynced changes) so the person can sign back in.
  useEffect(() => {
    if (!user || isDemoMode()) return
    return onSessionRejected(() => {
      void dropAuth()
    })
  }, [user, dropAuth])

  // Keep an actively used session alive: while the app is open and visible,
  // check in with the server now and then (and whenever it comes back to the
  // foreground). Each check slides the expiry forward server-side, so a
  // session only ends after a long stretch of not using Fico at all.
  useEffect(() => {
    if (!user || isDemoMode()) return
    let last = Date.now()
    const ping = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < KEEPALIVE_MS) return
      last = Date.now()
      void getMe(COLD_START_TIMEOUT_MS)
        .then((response) => applyServerAuth(response.user, response.session))
        .catch(async (error) => {
          if (isSessionRejected(error)) await dropAuth()
        })
    }
    const timer = window.setInterval(ping, 60 * 1000)
    document.addEventListener('visibilitychange', ping)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', ping)
    }
  }, [user, applyServerAuth, dropAuth])

  const login = async (identifier: string, password: string) => {
    const deviceId = await ensureDeviceId().catch(() => undefined)
    const response = await loginRequest(identifier, password, deviceId)
    if (!('user' in response)) {
      return { requiresTwoFactor: true as const, pendingToken: response.pendingToken }
    }
    await applyServerAuth(response.user, response.session)
  }

  const googleSignIn = async (credential: string, termsAccepted: boolean, inviteCode?: string) => {
    const deviceId = await ensureDeviceId().catch(() => undefined)
    const response = await googleAuthRequest(credential, termsAccepted, deviceId, inviteCode)
    if (!('user' in response)) {
      return { requiresTwoFactor: true as const, pendingToken: response.pendingToken }
    }
    await applyServerAuth(response.user, response.session)
  }

  const verifyTwoFactor = async (pendingToken: string, code: string) => {
    const deviceId = await ensureDeviceId().catch(() => undefined)
    const response = await verifyTwoFactorRequest(pendingToken, code, deviceId)
    await applyServerAuth(response.user, response.session)
  }

  const refreshUser = async () => {
    if (isDemoMode()) {
      setUser(loadDemoUser())
      return
    }
    const response = await getMe()
    await applyServerAuth(response.user, response.session)
  }

  const register = async (
    username: string,
    email: string,
    password: string,
    termsAccepted: boolean,
    inviteCode: string,
  ) => {
    const deviceId = await ensureDeviceId().catch(() => undefined)
    const response = await registerRequest(
      username,
      email,
      password,
      termsAccepted,
      deviceId,
      inviteCode,
    )
    await applyServerAuth(response.user, response.session)
  }

  /** "Try the demo": a device-only account opened on the sample Finance. */
  const startDemo = async () => {
    const demoUser = enterDemoMode()
    await seedDemoData(demoUser.id)
    seedDemoNotifications()
    setOffline(false)
    setUser(demoUser)
  }

  const logout = async () => {
    if (isDemoMode()) {
      // Leaving the demo wipes everything it made on this device.
      await purgeDemoData().catch(() => undefined)
      leaveDemoMode()
      clearNotificationCache()
      // Tried the demo while signed in? Go back to your own account, not
      // the sign-in screen — that sign-in never ended.
      const local = await loadLocalAuth().catch(() => null)
      if (local) {
        setUser(userFromLocal(local.user))
        setOffline(true) // re-confirmed with the server as usual
        return
      }
      markJustSignedOut()
      setUser(null)
      return
    }
    try {
      await logoutRequest()
    } catch {
      // Offline or already gone — clear locally regardless.
    } finally {
      await dropAuth({ markSignedOut: true, keepUnsynced: false })
      clearSnapshots()
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        offline,
        login,
        googleSignIn,
        verifyTwoFactor,
        register,
        logout,
        refreshUser,
        demo: user?.id === DEMO_USER_ID,
        startDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
