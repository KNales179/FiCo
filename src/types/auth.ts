export type UserRole = 'ADMIN' | 'USER'

export interface NotificationPreferences {
  billReminders: boolean
  shoppingUpdates: boolean
  billUpdates: boolean
  accountActivity: boolean
  /** Only meaningful for an admin account, but harmless on every other one. */
  feedbackReports: boolean
}

export interface User {
  id: string
  username: string
  email: string
  displayName?: string | null
  role?: UserRole
  totpEnabled?: boolean
  emailVerified?: boolean
  avatarUrl?: string | null
  notificationPreferences?: NotificationPreferences
}

export interface SessionInfo {
  /** ISO timestamp when the server session expires. */
  expiresAt: string
}

export interface AuthResponse {
  success: boolean
  message: string
  user: User
  session?: SessionInfo
}

/** What `POST /auth/login` returns when the account needs a second factor. */
export interface TwoFactorRequired {
  success: true
  requiresTwoFactor: true
  pendingToken: string
  message: string
}

export interface MeResponse {
  success: boolean
  user: User
  session?: SessionInfo
}

/** A device/session on your own account, or (for an admin) someone else's. */
export interface DeviceSession {
  id: string
  deviceId: string | null
  userAgent: string | null
  createdAt: string
  lastUsedAt: string
  expiresAt: string
  /** Only present on your own list — which row is the one you're using right now. */
  isCurrent?: boolean
}
