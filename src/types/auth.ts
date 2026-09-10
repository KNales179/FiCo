export interface User {
  id: string
  username: string
  email: string
  displayName?: string | null
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

export interface MeResponse {
  success: boolean
  user: User
  session?: SessionInfo
}
