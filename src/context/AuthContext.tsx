import {
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import type { User } from '../types/auth'
import {
  getMe,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
} from '../services/authService'
import { AuthContext } from './auth-context'

export const AuthProvider = ({
  children,
}: {
  children: ReactNode
}) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const response = await getMe()
        setUser(response.user)
      } catch {
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    restoreSession()
  }, [])

  const login = async (identifier: string, password: string) => {
    const response = await loginRequest(identifier, password)
    setUser(response.user)
  }

  const register = async (
    username: string,
    email: string,
    password: string,
  ) => {
    const response = await registerRequest(username, email, password)
    setUser(response.user)
  }

  const logout = async () => {
    try {
      await logoutRequest()
    } finally {
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
