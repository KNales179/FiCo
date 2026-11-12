import type { SpaceSummary } from '../../types/space'

/**
 * The tutorial's sample Finance. It lives only in this device's IndexedDB
 * for as long as a guided tour runs, is never synced (enqueueMutation and
 * the sync engine both skip it), and is wiped when the tour ends — or on
 * the next start-up, if the app closed mid-tour.
 */
export const DEMO_SPACE_ID = 'fico-tour-sample'

export const isDemoSpace = (spaceId: string | null | undefined): boolean =>
  spaceId === DEMO_SPACE_ID

export const demoSpaceSummary = (userId: string, currency = 'PHP'): SpaceSummary => {
  const now = new Date().toISOString()
  return {
    id: DEMO_SPACE_ID,
    name: 'Sample Finance',
    type: 'FAMILY',
    ownerId: userId,
    currency,
    role: 'OWNER',
    createdAt: now,
    updatedAt: now,
  }
}
