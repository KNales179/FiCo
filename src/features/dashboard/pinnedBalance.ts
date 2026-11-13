/** A balance a person pinned on the dashboard — per Finance, kept on this device. */

export type PinMode = 'beside' | 'instead'
export interface PinnedChoice {
  accountId: string
  mode: PinMode
}

const keyFor = (spaceId: string) => `fico.pinnedBalance.${spaceId}`

/** The balance this person pinned in this Finance (kept on this device — it's a personal view). */
export const loadPinned = (spaceId: string | null | undefined): PinnedChoice | null => {
  if (!spaceId) return null
  try {
    const raw = localStorage.getItem(keyFor(spaceId))
    return raw ? (JSON.parse(raw) as PinnedChoice) : null
  } catch {
    return null
  }
}

export const savePinned = (spaceId: string, choice: PinnedChoice | null) => {
  try {
    if (choice) localStorage.setItem(keyFor(spaceId), JSON.stringify(choice))
    else localStorage.removeItem(keyFor(spaceId))
  } catch {
    // Storage blocked — it just won't be remembered.
  }
}

