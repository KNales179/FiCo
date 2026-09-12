import { metadataRepository } from '../../repositories'

/**
 * A tiny per-device "have I looked at this section since it last changed"
 * cursor (Roadmap feedback: highlight what a shared Finance's *other*
 * members added until you've actually seen it). One timestamp per feature
 * area per space — not per record — so "seen" is cheap to check and cheap
 * to update. Deliberately local-only (not synced): it's a per-device
 * reading cue, not data anyone else needs to see.
 */
const key = (area: string, spaceId: string) => `seen.${area}.${spaceId}`

export const getLastSeenAt = async (
  area: string,
  spaceId: string,
): Promise<string | null> =>
  (await metadataRepository.get<string>(key(area, spaceId))) ?? null

/** Call when leaving the section (or opening a specific unseen item). */
export const markSeenNow = async (
  area: string,
  spaceId: string,
): Promise<void> => {
  await metadataRepository.set(key(area, spaceId), new Date().toISOString())
}

/**
 * True when a record is worth highlighting: someone *else* added it, after
 * the last time this device looked at this section. Your own additions are
 * never highlighted back at you.
 */
export const isUnseen = (
  createdAt: string,
  createdBy: string | null | undefined,
  lastSeenAt: string | null,
  currentUserId: string | undefined,
): boolean =>
  !!createdBy &&
  createdBy !== currentUserId &&
  (!lastSeenAt || createdAt > lastSeenAt)
