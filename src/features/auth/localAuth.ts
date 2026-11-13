import { getDeviceId, initDB } from '../../db/bootstrap'
import { deleteDatabase, getDB } from '../../db/database'
import { DB_VERSION } from '../../db/schema'
import {
  MetadataKeys,
  metadataRepository,
  attachmentRepository,
  sessionRepository,
  syncEventRepository,
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
    birthday: user.birthday !== undefined ? user.birthday : existingUser?.birthday,
    paydays: user.paydays ?? existingUser?.paydays,
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

/**
 * Return the local authentication for this device, or null — for opening
 * Fico *offline*, so it deliberately does not enforce `expiresAt`.
 *
 * That field mirrors the server's own session expiry, which only actually
 * renews (slides forward) on a request the server sees — so a device that
 * has been offline for a while, or that just hasn't made a fresh `getMe()`
 * call in the current tab, can have a locally-stale `expiresAt` that looks
 * "expired" even though the real, server-side session is still perfectly
 * valid. There is no way to renew it while offline anyway, so treating a
 * past `expiresAt` as a hard local lockout only means: a device that was
 * legitimately signed in can no longer be *used* offline — precisely the
 * case this function exists for (owner feedback: a personal or shared
 * Finance should still open with whatever was last cached when there's no
 * connection, not force a login it's impossible to complete). Real
 * expiry/revocation enforcement happens online, against the server, the
 * moment connectivity returns (`AuthContext`'s reconnect-revalidation
 * effect) — this local copy only ever grants *provisional* access.
 *
 * `revokedAt` and the account's own status are still honored — those are
 * "this device/account should never have gotten in", not "hasn't proven
 * itself recently enough".
 */
export async function loadLocalAuth(): Promise<LocalAuthSnapshot | null> {
  const deviceId = await ensureDeviceId()

  const session = await sessionRepository.get(deviceId)
  if (!session || session.revokedAt) {
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

/**
 * Forget this device's local authentication (logout, or a rejected
 * session) — and, since this device may be shared (a family computer,
 * say), every other space's financial data cached locally for whoever
 * was signed in goes with it (frontend-data-performance §"clear
 * user-specific cache on logout to prevent data leakage"). The next
 * login re-syncs from the server, which costs a one-time full re-pull —
 * an acceptable trade for never leaving one person's transactions, bills,
 * or shopping lists sitting in IndexedDB for the next person who signs
 * into a *different* account on the same browser.
 *
 * The device id itself is deliberately preserved across the wipe — it's
 * not personal data, and losing it would make this device look "new" to
 * the server on next login, breaking device recognition (Fico's Sessions
 * feature) for no reason.
 */
export async function clearLocalAuth({
  markSignedOut = false,
  keepUnsynced = false,
}: { markSignedOut?: boolean; keepUnsynced?: boolean } = {}): Promise<void> {
  await initDB()
  const deviceId = await getDeviceId()

  // Signed out by the server (session expired after a long time offline,
  // say) while this device still holds changes it never managed to send:
  // never delete those. Keep everything, forget only the sign-in, and note
  // whose changes they are — signing back in as that person sends them up;
  // anyone else signing in gets a clean slate (see prepareLocalDataFor).
  if (keepUnsynced) {
    const unsynced = await countUnsyncedChanges()
    if (unsynced > 0) {
      const userId = await metadataRepository.get<string>(MetadataKeys.authUserId)
      const user = userId ? await userRepository.get(userId) : undefined
      if (userId) {
        await metadataRepository.set(UNSYNCED_OWNER_KEY, {
          userId,
          username: user?.username ?? null,
          count: unsynced,
        } satisfies UnsyncedOwner)
      }
      await sessionRepository.revoke(deviceId).catch(() => undefined)
      await metadataRepository.remove(MetadataKeys.authUserId)
      if (markSignedOut) await metadataRepository.set(SIGNED_OUT_KEY, true)
      return
    }
  }

  await deleteDatabase()

  // deleteDatabase() closes the connection; reopen a fresh one (this also
  // re-runs every migration against the now-empty database) and restore
  // just the device id and schema version initDB() would otherwise have
  // set — initDB() itself only ever does that work once per app load, so
  // it won't repeat it for us here.
  await getDB()
  await metadataRepository.set(MetadataKeys.deviceId, deviceId)
  await metadataRepository.set('schema.version', DB_VERSION)
  if (markSignedOut) {
    await metadataRepository.set(SIGNED_OUT_KEY, true)
  }
}

const UNSYNCED_OWNER_KEY = 'auth.unsyncedOwner'

export interface UnsyncedOwner {
  userId: string
  username: string | null
  count: number
}

/** Changes made on this device that the server hasn't accepted yet (waiting, or failed). */
export async function countUnsyncedChanges(): Promise<number> {
  await initDB()
  const [pending, failed] = await Promise.all([
    syncEventRepository.listPending(),
    syncEventRepository.listByStatus('FAILED'),
  ])
  // Receipt photos aren't part of the change queue any more — count the
  // ones still waiting on this device directly.
  const photos = (await attachmentRepository.listPendingUpload()).filter((a) => !a.deletedAt).length
  return [...pending, ...failed].filter((e) => e.entityType !== 'attachment').length + photos
}

/** Unsynced changes kept from a sign-out the person didn't choose (shown on the sign-in screen). */
export async function loadUnsyncedOwner(): Promise<UnsyncedOwner | null> {
  await initDB()
  return (await metadataRepository.get<UnsyncedOwner>(UNSYNCED_OWNER_KEY)) ?? null
}

/**
 * Right before a successful sign-in is stored: if this device still holds
 * someone *else's* data (kept unsynced changes, or a previous account that
 * was never cleared), wipe it first so one person's records never show up
 * in another's account. The same person's kept changes stay, and sync.
 */
export async function prepareLocalDataFor(userId: string): Promise<void> {
  await initDB()
  const kept = await metadataRepository.get<UnsyncedOwner>(UNSYNCED_OWNER_KEY)
  const previous = await metadataRepository.get<string>(MetadataKeys.authUserId)
  const otherOwner = (kept && kept.userId !== userId) || (previous && previous !== userId)
  if (otherOwner) {
    await clearLocalAuth()
    return
  }
  if (kept) await metadataRepository.remove(UNSYNCED_OWNER_KEY)
}

/** Did the user explicitly sign out (possibly while offline)? */
export async function wasSignedOut(): Promise<boolean> {
  await initDB()
  return (await metadataRepository.get<boolean>(SIGNED_OUT_KEY)) === true
}
