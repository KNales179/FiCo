import { syncEventRepository } from '../../repositories'
import type { SyncOperation } from '../../types/models'
import type { MutationContext } from './context'
import { emitMutation } from './events'
import { isDemoSpace } from '../demo/space'

/**
 * Records a local mutation on the outbound sync queue and nudges the sync
 * engine. Each event carries a stable id for idempotent server processing
 * (Architecture §34, §38).
 */
export const enqueueMutation = async (
  ctx: MutationContext,
  entityType: string,
  entityId: string,
  operation: SyncOperation,
  payload: unknown,
  clientVersion = 1,
) => {
  // The tutorial's sample Finance is local-only and temporary — nothing
  // that happens inside it may ever reach the server.
  if (isDemoSpace(ctx.spaceId)) {
    emitMutation()
    return null
  }
  const event = await syncEventRepository.enqueue({
    deviceId: ctx.deviceId,
    userId: ctx.userId,
    spaceId: ctx.spaceId,
    entityType,
    entityId,
    operation,
    payload,
    clientVersion,
  })
  emitMutation()
  return event
}
