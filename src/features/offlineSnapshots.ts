/**
 * Small "as of the last time you were online" copies of things that only the
 * server knows (who's in a Finance, the Activity log), so those screens show
 * something useful offline instead of going blank. Read-only, per device,
 * and wiped on sign-out so the next person on this device never sees them.
 */
const PREFIX = 'fico.snapshot.'
/** The Members page's cache from before this module existed. */
const LEGACY_PREFIXES = ['fico.membersCache.']

export interface Snapshot<T> {
  value: T
  /** When it was saved (ISO), to say "as of …". */
  savedAt: string
}

export const saveSnapshot = <T>(key: string, value: T): void => {
  try {
    const snap: Snapshot<T> = { value, savedAt: new Date().toISOString() }
    localStorage.setItem(PREFIX + key, JSON.stringify(snap))
  } catch {
    // Storage full or blocked — offline just won't have a copy.
  }
}

export const loadSnapshot = <T>(key: string): Snapshot<T> | null => {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const snap = JSON.parse(raw) as Snapshot<T>
    return snap && 'value' in snap ? snap : null
  } catch {
    return null
  }
}

/** Sign-out: forget every saved copy. */
export const clearSnapshots = (): void => {
  try {
    const doomed: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && [PREFIX, ...LEGACY_PREFIXES].some((p) => key.startsWith(p))) doomed.push(key)
    }
    doomed.forEach((key) => localStorage.removeItem(key))
  } catch {
    // ignore
  }
}

export const membersSnapshotKey = (spaceId: string) => `members.${spaceId}`
