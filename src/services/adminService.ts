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
  avatarUrl?: string | null
  restricted?: boolean
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
  reason?: string,
) =>
  api<{ success: boolean; message: string }>(
    `/admin/users/${userId}/password`,
    { method: 'POST', body: { newPassword, confirmPassword, reason: reason || undefined } },
  )

/** Turns off someone's two-step sign-in (they lost their phone and backup codes). */
export const resetUserTwoFactor = (userId: string, confirmPassword: string, reason?: string) =>
  api<{ success: boolean; message: string }>(`/admin/users/${userId}/2fa/reset`, {
    method: 'POST',
    body: { confirmPassword, reason: reason || undefined },
  })

export const setUserRole = (
  userId: string,
  role: UserRole,
  confirmPassword: string,
  reason?: string,
) =>
  api<{ success: boolean; message: string }>(
    `/admin/users/${userId}/role`,
    { method: 'POST', body: { role, confirmPassword, reason: reason || undefined } },
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

type Ok = { success: boolean; message: string }

export interface AdminUserProfile {
  id: string
  username: string
  email: string
  displayName: string | null
  avatarUrl: string | null
  status: 'ACTIVE' | 'DISABLED'
  role: UserRole
  totpEnabled: boolean
  emailVerified: boolean
  createdAt: string
  lastActiveAt: string | null
  isSelf: boolean
  restriction: { reason: string; until: string | null; at: string } | null
  deletedByAdmin: { reason: string; at: string } | null
  stats: { finances: number; ownedFinances: number; feedbackOpen: number; feedbackTotal: number }
}

export interface AdminAuditEntry {
  id: string
  action: string
  result: 'SUCCESS' | 'FAILURE'
  detail: string | null
  actor: string
  createdAt: string
}

export const getUserProfile = (userId: string) =>
  api<{ success: boolean; user: AdminUserProfile; sessions: DeviceSession[]; audit: AdminAuditEntry[] }>(
    `/admin/users/${userId}`,
  )

/** A message to one user; anonymous ones are signed "Fico Admin Team". */
export const sendUserNotice = (userId: string, body: { title?: string; message: string; anonymous: boolean }) =>
  api<Ok>(`/admin/users/${userId}/notice`, { method: 'POST', body })

export const signOutUserEverywhere = (userId: string, reason?: string) =>
  api<Ok>(`/admin/users/${userId}/sign-out`, { method: 'POST', body: { reason: reason || undefined } })

/** `durationHours` null = until lifted. */
export const restrictUser = (userId: string, reason: string, durationHours: number | null, confirmPassword: string) =>
  api<Ok>(`/admin/users/${userId}/restrict`, { method: 'POST', body: { reason, durationHours, confirmPassword } })

export const unrestrictUser = (userId: string, note?: string) =>
  api<Ok>(`/admin/users/${userId}/unrestrict`, { method: 'POST', body: { note: note || undefined } })

export const deleteUser = (userId: string, reason: string, confirmPassword: string) =>
  api<Ok>(`/admin/users/${userId}`, { method: 'DELETE', body: { reason, confirmPassword } })
