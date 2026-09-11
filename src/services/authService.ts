import { api } from '../lib/api'
import type {
  AuthResponse,
  MeResponse,
  User,
} from '../types/auth'

export const register = (
  username: string,
  email: string,
  password: string,
  deviceId?: string,
) => {
  return api<AuthResponse>('/auth/register', {
    method: 'POST',
    body: {
      username,
      email,
      password,
      deviceId,
    },
  })
}

export const login = (
  identifier: string,
  password: string,
  deviceId?: string,
) => {
  return api<AuthResponse>('/auth/login', {
    method: 'POST',
    body: {
      identifier,
      password,
      deviceId,
    },
  })
}

export const logout = () => {
  return api<{ success: boolean; message: string }>(
    '/auth/logout',
    {
      method: 'POST',
    },
  )
}

export const getMe = () => {
  return api<MeResponse>('/auth/me')
}

export const updateMe = (
  updates: Partial<Pick<User, 'username' | 'email'>>,
) => {
  return api<AuthResponse>('/auth/me', {
    method: 'PATCH',
    body: updates,
  })
}

export const deleteMe = (password: string) => {
  return api<{ success: boolean; message: string }>(
    '/auth/me',
    {
      method: 'DELETE',
      body: {
        password,
      },
    },
  )
}

/**
 * TEMPORARY — calls the dev-only recovery endpoint. Remove alongside
 * `DevResetPassword.tsx`, its route in `App.tsx`, and the backend route once
 * real password reset ships.
 */
export const devResetPassword = (identifier: string, newPassword: string) => {
  return api<{ success: boolean; message: string }>(
    '/auth/dev-reset-password',
    {
      method: 'POST',
      body: { identifier, newPassword },
    },
  )
}