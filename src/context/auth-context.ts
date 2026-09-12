import { createContext } from 'react'
import type { User } from '../types/auth'

/** What `login` resolves to when the account needs a second factor before a session exists. */
export interface LoginNeedsTwoFactor {
  requiresTwoFactor: true
  pendingToken: string
}

export interface AuthContextValue {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  /** Authenticated from a stored local session while the server is unreachable. */
  offline: boolean
  login: (
    identifier: string,
    password: string,
  ) => Promise<LoginNeedsTwoFactor | void>
  /** Finishes a login that `login` paused on `requiresTwoFactor`. */
  verifyTwoFactor: (pendingToken: string, code: string) => Promise<void>
  register: (
    username: string,
    email: string,
    password: string,
    termsAccepted: boolean,
  ) => Promise<void>
  logout: () => Promise<void>
  /** Re-pulls the current user (role/2FA status can change from Account/Admin actions). */
  refreshUser: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
)
