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
  /** Sign in (or create an account) with Google — may pause for 2FA like `login`. */
  /** `inviteCode` is needed only when this creates a new account (Fico is invite-only). */
  googleSignIn: (credential: string, termsAccepted: boolean, inviteCode?: string) => Promise<LoginNeedsTwoFactor | void>
  /** Finishes a login that `login` paused on `requiresTwoFactor`. */
  verifyTwoFactor: (pendingToken: string, code: string) => Promise<void>
  register: (
    username: string,
    email: string,
    password: string,
    termsAccepted: boolean,
    inviteCode: string,
  ) => Promise<void>
  logout: () => Promise<void>
  /** Re-pulls the current user (role/2FA status can change from Account/Admin actions). */
  refreshUser: () => Promise<void>
  /** Signed in to the device-only demo account. */
  demo: boolean
  /** "Try the demo" — opens the demo account with sample data. */
  startDemo: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
)
