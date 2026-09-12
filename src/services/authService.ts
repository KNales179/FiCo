import { api } from '../lib/api'
import type {
  AuthResponse,
  DeviceSession,
  MeResponse,
  TwoFactorRequired,
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
  return api<AuthResponse | TwoFactorRequired>('/auth/login', {
    method: 'POST',
    body: {
      identifier,
      password,
      deviceId,
    },
  })
}

/** Second step of login for an account with 2FA on — a 6-digit code or a backup code. */
export const verifyTwoFactorLogin = (
  pendingToken: string,
  code: string,
  deviceId?: string,
) => {
  return api<AuthResponse>('/auth/login/verify-2fa', {
    method: 'POST',
    body: { pendingToken, code, deviceId },
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

/** Change your own password while signed in — needs the current one, not email. */
export const changePassword = (currentPassword: string, newPassword: string) => {
  return api<{ success: boolean; message: string }>('/auth/change-password', {
    method: 'POST',
    body: { currentPassword, newPassword },
  })
}

/** Device recognition: every device your own account is currently logged into. */
export const listMySessions = () =>
  api<{ success: boolean; sessions: DeviceSession[] }>('/auth/sessions')

export const revokeMySession = (sessionId: string) =>
  api<{ success: boolean; message: string }>(
    `/auth/sessions/${sessionId}/revoke`,
    { method: 'POST' },
  )

export const startTwoFactorSetup = () =>
  api<{ success: boolean; secret: string; uri: string }>('/auth/2fa/setup', {
    method: 'POST',
  })

export const confirmTwoFactorSetup = (code: string) =>
  api<{ success: boolean; message: string; backupCodes: string[] }>(
    '/auth/2fa/confirm',
    { method: 'POST', body: { code } },
  )

export const disableTwoFactor = (password: string, code: string) =>
  api<{ success: boolean; message: string }>('/auth/2fa/disable', {
    method: 'POST',
    body: { password, code },
  })

/** Ask for a new verification link — the earlier one expired, or never arrived. */
export const resendVerificationEmail = () =>
  api<{ success: boolean; message: string }>('/auth/verify-email/resend', {
    method: 'POST',
  })

/** The token from the link in the verification email. */
export const verifyEmail = (token: string) =>
  api<{ success: boolean; message: string }>('/auth/verify-email', {
    method: 'POST',
    body: { token },
  })

/** Always resolves with the same generic message — never reveals whether the account exists. */
export const forgotPassword = (identifier: string) =>
  api<{ success: boolean; message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: { identifier },
  })

/** The token from the link in the password-reset email, plus the chosen new password. */
export const resetPassword = (token: string, newPassword: string) =>
  api<{ success: boolean; message: string }>('/auth/reset-password', {
    method: 'POST',
    body: { token, newPassword },
  })
