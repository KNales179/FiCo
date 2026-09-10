import { createContext } from 'react'
import type { User } from '../types/auth'

export interface AuthContextValue {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  login: (identifier: string, password: string) => Promise<void>
  register: (
    username: string,
    email: string,
    password: string,
  ) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
)
