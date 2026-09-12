import { useCallback, useEffect, useState } from 'react'
import { getLastSeenAt, isUnseen } from '../features/seen'
import { onDataChanged } from '../features/sync/events'

/**
 * True when *any* row in the given list was added by someone else since
 * this device last looked at that feature area — the small red-dot signal
 * on a nav item (Roadmap feedback: "the rest of the user will get notify
 * that this shopping list is created, then the navbar will have red dot
 * indicator"). `fetchAll` must be stable (wrap it in `useCallback` at the
 * call site) or this re-checks on every render.
 */
export const useUnseenBadge = <
  T extends { createdAt: string; createdBy?: string | null },
>(
  area: string,
  spaceId: string | null | undefined,
  currentUserId: string | undefined,
  fetchAll: () => Promise<T[]>,
): boolean => {
  const [unseen, setUnseen] = useState(false)

  const check = useCallback(async () => {
    if (!spaceId) {
      setUnseen(false)
      return
    }
    const [rows, lastSeenAt] = await Promise.all([
      fetchAll(),
      getLastSeenAt(area, spaceId),
    ])
    setUnseen(
      rows.some((r) => isUnseen(r.createdAt, r.createdBy, lastSeenAt, currentUserId)),
    )
  }, [area, spaceId, currentUserId, fetchAll])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void check()
  }, [check])
  useEffect(() => onDataChanged(() => void check()), [check])

  return unseen
}
