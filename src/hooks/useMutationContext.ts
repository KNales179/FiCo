import { useEffect, useState } from 'react'
import { ensureDeviceId } from '../features/auth/localAuth'
import type { MutationContext } from '../features/sync/context'
import { useAuth } from './useAuth'
import { useSpace } from './useSpace'

/**
 * Assembles the `{ spaceId, userId, deviceId }` needed to make a local change
 * in the active space, plus whether the current member may edit it.
 */
export const useMutationContext = (): {
  ctx: MutationContext | null
  canEdit: boolean
} => {
  const { user } = useAuth()
  const { activeSpace, activeSpaceId } = useSpace()
  const [deviceId, setDeviceId] = useState<string | null>(null)

  useEffect(() => {
    void ensureDeviceId().then(setDeviceId).catch(() => setDeviceId(null))
  }, [])

  // Every member of a Finance can edit it — there is no view-only role.
  const canEdit = Boolean(activeSpace?.role)

  const ctx =
    activeSpaceId && user?.id && deviceId
      ? { spaceId: activeSpaceId, userId: user.id, deviceId }
      : null

  return { ctx, canEdit: Boolean(canEdit) }
}
