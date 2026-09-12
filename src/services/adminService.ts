import { api } from '../lib/api'
import type { DeviceSession, UserRole } from '../types/auth'

export interface AdminUser {
  id: string
  username: string
  email: string
  displayName: string | null
  status: 'ACTIVE' | 'DISABLED'
  role: UserRole
  totpEnabled: boolean
  emailVerified: boolean
  createdAt: string
  isSelf: boolean
}

export const listUsers = () =>
  api<{ success: boolean; users: AdminUser[] }>('/admin/users')

/** `confirmPassword` is the *acting admin's own* current password, re-checked
 *  on every sensitive action taken on someone else's account. */
export const setUserPassword = (
  userId: string,
  newPassword: string,
  confirmPassword: string,
) =>
  api<{ success: boolean; message: string }>(
    `/admin/users/${userId}/password`,
    { method: 'POST', body: { newPassword, confirmPassword } },
  )

export const setUserRole = (
  userId: string,
  role: UserRole,
  confirmPassword: string,
) =>
  api<{ success: boolean; message: string }>(
    `/admin/users/${userId}/role`,
    { method: 'POST', body: { role, confirmPassword } },
  )

export const listUserSessions = (userId: string) =>
  api<{ success: boolean; sessions: DeviceSession[] }>(
    `/admin/users/${userId}/sessions`,
  )

export const revokeUserSession = (userId: string, sessionId: string) =>
  api<{ success: boolean; message: string }>(
    `/admin/users/${userId}/sessions/${sessionId}/revoke`,
    { method: 'POST' },
  )
