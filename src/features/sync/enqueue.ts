import { syncEventRepository } from '../../repositories'
import type { SyncOperation } from '../../types/models'
import type { MutationContext } from './context'

/**
 * Records a local mutation on the outbound sync queue. Until the sync engine
 * lands (Phase 18) these just accumulate; each already carries a stable id for
 * idempotent server processing (Architecture §34, §38).
 */
export const enqueueMutation = (
  ctx: MutationContext,
  entityType: string,
  entityId: string,
  operation: SyncOperation,
  payload: unknown,
  clientVersion = 1,
) =>
  syncEventRepository.enqueue({
    deviceId: ctx.deviceId,
    userId: ctx.userId,
    spaceId: ctx.spaceId,
    entityType,
    entityId,
    operation,
    payload,
    clientVersion,
  })
