import { getDeviceId, initDB } from '../../db/bootstrap'
import {
  MetadataKeys,
  metadataRepository,
  sessionRepository,
  userRepository,
} from '../../repositories'
import type { SessionInfo, User } from '../../types/auth'
import type { LocalSession, LocalUser } from '../../types/models'

/**
 * Local authentication state, kept in IndexedDB so a device that has logged in
 * once can open Fico while offline (Architecture §42). The session *token*
 * stays in an httpOnly cookie and is never stored here — only the fact that
 * this device is authenticated, for whom, and until when.
 */

export interface LocalAuthSnapshot {
  user: LocalUser
  session: LocalSession
}

/** Fallback session length if the server response omits an expiry. */
const DEFAULT_LOCAL_SESSION_DAYS = 7

/**
 * Metadata flag set when the user logs out. It matters for an *offline* logout:
 * the httpOnly session cookie is still valid, so without this the next online
 * startup would silently sign the user back in.
 */
const SIGNED_OUT_KEY = 'auth.signedOut'

/** Opens the DB (once) and returns this browser profile's stable device id. */
export async function ensureDeviceId(): Promise<string> {
  await initDB()
  return getDeviceId()
}

function resolveExpiry(session?: SessionInfo): string {
  if (session?.expiresAt) {
    return session.expiresAt
  }
  const expiry = new Date()
  expiry.setDate(expiry.getDate() + DEFAULT_LOCAL_SESSION_DAYS)
  return expiry.toISOString()
}

/** Record a successful server authentication for later offline startup. */
export async function persistLocalAuth(
  user: User,
  session?: SessionInfo,
): Promise<void> {
  const deviceId = await ensureDeviceId()
  const now = new Date().toISOString()

  const existingUser = await userRepository.get(user.id)
  const localUser: LocalUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName ?? existingUser?.displayName ?? undefined,
    status: 'ACTIVE',
    createdAt: existingUser?.createdAt ?? now,
    updatedAt: now,
  }
  await userRepository.upsert(localUser)

  const existingSession = await sessionRepository.get(deviceId)
  const localSession: LocalSession = {
    id: deviceId,
    userId: user.id,
    deviceId,
    authenticatedAt: existingSession?.authenticatedAt ?? now,
    expiresAt: resolveExpiry(session),
    lastValidatedAt: now,
    revokedAt: null,
  }
  await sessionRepository.save(localSession)

  await metadataRepository.set(MetadataKeys.authUserId, user.id)
  await metadataRepository.remove(SIGNED_OUT_KEY)
}

/** Return a still-valid local authentication for this device, or null. */
export async function loadLocalAuth(): Promise<LocalAuthSnapshot | null> {
  const deviceId = await ensureDeviceId()

  const session = await sessionRepository.get(deviceId)
  if (
    !session ||
    session.revokedAt ||
    new Date(session.expiresAt).getTime() <= Date.now()
  ) {
    return null
  }

  const user = await userRepository.get(session.userId)
  if (!user || user.status !== 'ACTIVE') {
    return null
  }

  return { user, session }
}

/** Note that the server has just re-confirmed this device's session. */
export async function touchLocalAuth(): Promise<void> {
  const deviceId = await ensureDeviceId()
  await sessionRepository.markValidated(deviceId)
}

/** Forget this device's local authentication (logout, or a rejected session). */
export async function clearLocalAuth({
  markSignedOut = false,
}: { markSignedOut?: boolean } = {}): Promise<void> {
  await initDB()
  await sessionRepository.clear()
  await metadataRepository.remove(MetadataKeys.authUserId)
  if (markSignedOut) {
    await metadataRepository.set(SIGNED_OUT_KEY, true)
  }
}

/** Did the user explicitly sign out (possibly while offline)? */
export async function wasSignedOut(): Promise<boolean> {
  await initDB()
  return (await metadataRepository.get<boolean>(SIGNED_OUT_KEY)) === true
}
