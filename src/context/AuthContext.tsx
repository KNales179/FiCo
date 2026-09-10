import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import { isNetworkError } from '../lib/api'
import type { SessionInfo, User } from '../types/auth'
import {
  getMe,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
} from '../services/authService'
import {
  clearLocalAuth,
  ensureDeviceId,
  loadLocalAuth,
  persistLocalAuth,
  wasSignedOut,
} from '../features/auth/localAuth'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { AuthContext } from './auth-context'

const toUser = (user: User): User => ({
  id: user.id,
  username: user.username,
  email: user.email,
  displayName: user.displayName ?? null,
})

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)
  const online = useOnlineStatus()
  const revalidating = useRef(false)

  const applyServerAuth = useCallback(
    async (nextUser: User, session?: SessionInfo) => {
      setUser(toUser(nextUser))
      setOffline(false)
      await persistLocalAuth(nextUser, session)
    },
    [],
  )

  const dropAuth = useCallback(
    async (options?: { markSignedOut?: boolean }) => {
      await clearLocalAuth(options)
      setUser(null)
      setOffline(false)
    },
    [],
  )

  // Startup: prefer the server, fall back to a stored local session when offline.
  useEffect(() => {
    let cancelled = false

    const restore = async () => {
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

      try {
        const response = await getMe()
        if (cancelled) return
        await applyServerAuth(response.user, response.session)
      } catch (error) {
        if (cancelled) return

        if (isNetworkError(error)) {
          const local = await loadLocalAuth()
          if (cancelled) return
          if (local) {
            setUser({
              id: local.user.id,
              username: local.user.username,
              email: local.user.email ?? '',
              displayName: local.user.displayName ?? null,
            })
            setOffline(true)
          } else {
            setUser(null)
          }
        } else {
          // The server rejected the session — this device is no longer trusted.
          await dropAuth()
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void restore()

    return () => {
      cancelled = true
    }
  }, [applyServerAuth, dropAuth])

  // Reconnected while running on an offline session — re-confirm with the server.
  useEffect(() => {
    if (!online || !offline || !user || revalidating.current) return

    revalidating.current = true
    void getMe()
      .then((response) => applyServerAuth(response.user, response.session))
      .catch(async (error) => {
        if (!isNetworkError(error)) {
          await dropAuth()
        }
      })
      .finally(() => {
        revalidating.current = false
      })
  }, [online, offline, user, applyServerAuth, dropAuth])

  const login = async (identifier: string, password: string) => {
    const deviceId = await ensureDeviceId().catch(() => undefined)
    const response = await loginRequest(identifier, password, deviceId)
    await applyServerAuth(response.user, response.session)
  }

  const register = async (
    username: string,
    email: string,
    password: string,
  ) => {
    const deviceId = await ensureDeviceId().catch(() => undefined)
    const response = await registerRequest(
      username,
      email,
      password,
      deviceId,
    )
    await applyServerAuth(response.user, response.session)
  }

  const logout = async () => {
    try {
      await logoutRequest()
    } catch {
      // Offline or already gone — clear locally regardless.
    } finally {
      await dropAuth({ markSignedOut: true })
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
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
