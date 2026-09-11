import { api, isNetworkError } from '../../lib/api'
import {
  MetadataKeys,
  metadataRepository,
  syncEventRepository,
} from '../../repositories'
import type { SyncEvent } from '../../types/models'
import type { MutationContext } from './context'
import {
  applyRemoteRecord,
  clearFailedFlag,
  isApplicableEntity,
  isLocallyPending,
  markLocalSyncStatus,
} from './apply'

const BATCH = 200
const PULL_PAGE = 500

interface PushResult {
  eventId: string
  status:
    | 'applied'
    | 'conflict-resolved'
    | 'duplicate'
    | 'rejected'
    | 'stale'
  message?: string
}

const cursorKey = (spaceId: string) => `sync.cursor.${spaceId}`

/** Push all pending local mutations for the active space. */
export const pushPending = async (
  ctx: MutationContext,
): Promise<{ pushed: number; rejected: number }> => {
  const pending = (await syncEventRepository.listPending()).filter(
    (e) =>
      e.spaceId === ctx.spaceId &&
      // Attachment blobs sync separately (not yet wired).
      e.entityType !== 'attachment',
  )
  if (pending.length === 0) return { pushed: 0, rejected: 0 }

  let pushed = 0
  let rejected = 0

  for (let i = 0; i < pending.length; i += BATCH) {
    const slice = pending.slice(i, i + BATCH)
    const body = {
      deviceId: ctx.deviceId,
      events: slice.map((e: SyncEvent) => ({
        id: e.id,
        entityType: e.entityType,
        entityId: e.entityId,
        operation: e.operation,
        payload: e.payload,
        clientVersion: e.clientVersion,
      })),
    }

    const res = await api<{ success: boolean; results: PushResult[] }>(
      `/spaces/${ctx.spaceId}/sync/push`,
      { method: 'POST', body },
    )

    const eventById = new Map(slice.map((e) => [e.id, e]))

    for (const result of res.results) {
      const event = eventById.get(result.eventId)
      if (result.status === 'rejected') {
        await syncEventRepository.setStatus(
          result.eventId,
          'FAILED',
          result.message ?? 'Rejected by the server',
        )
        if (event) {
          await markLocalSyncStatus(
            event.entityType,
            event.entityId,
            'FAILED',
          )
        }
        rejected += 1
      } else {
        // applied / conflict-resolved / duplicate / stale — the event is done.
        await syncEventRepository.remove(result.eventId)
        if (event) {
          await markLocalSyncStatus(
            event.entityType,
            event.entityId,
            'SYNCED',
          )
        }
        pushed += 1
      }
    }
  }

  return { pushed, rejected }
}

/** Pull remote changes for the active space and apply them locally. */
export const pull = async (
  ctx: MutationContext,
): Promise<{ applied: number }> => {
  let cursor =
    (await metadataRepository.get<string>(cursorKey(ctx.spaceId))) ??
    new Date(0).toISOString()

  let applied = 0
  let hasMore = true

  while (hasMore) {
    const res = await api<{
      success: boolean
      records: Array<{
        entityType: string
        clientId: string
        payload: Record<string, unknown>
        deletedAt: string | null
      }>
      cursor: string
      hasMore: boolean
    }>(
      `/spaces/${ctx.spaceId}/sync/pull?since=${encodeURIComponent(
        cursor,
      )}&limit=${PULL_PAGE}`,
    )

    for (const record of res.records) {
      if (!isApplicableEntity(record.entityType)) continue
      // Don't clobber a local edit that hasn't been pushed yet.
      if (await isLocallyPending(record.entityType, record.clientId)) {
        continue
      }
      await applyRemoteRecord(
        record.entityType,
        record.payload,
        record.deletedAt,
      )
      applied += 1
    }

    cursor = res.cursor
    hasMore = res.hasMore
    await metadataRepository.set(cursorKey(ctx.spaceId), cursor)
  }

  await metadataRepository.set(MetadataKeys.lastSyncAt, new Date().toISOString())
  return { applied }
}

export interface SyncOutcome {
  ok: boolean
  pushed: number
  rejected: number
  applied: number
  offline: boolean
  error?: string
}

/** One full sync cycle: push, then pull. */
export const runSync = async (
  ctx: MutationContext,
): Promise<SyncOutcome> => {
  try {
    const { pushed, rejected } = await pushPending(ctx)
    const { applied } = await pull(ctx)
    return { ok: true, pushed, rejected, applied, offline: false }
  } catch (err) {
    if (isNetworkError(err)) {
      return {
        ok: false,
        pushed: 0,
        rejected: 0,
        applied: 0,
        offline: true,
      }
    }
    return {
      ok: false,
      pushed: 0,
      rejected: 0,
      applied: 0,
      offline: false,
      error: err instanceof Error ? err.message : 'Sync failed',
    }
  }
}

const forSpace = (spaceId: string) => (e: { spaceId?: string | null; entityType: string }) =>
  e.spaceId === spaceId && e.entityType !== 'attachment'

export const countPendingForSpace = async (
  spaceId: string,
): Promise<number> => {
  const pending = await syncEventRepository.listPending()
  return pending.filter(forSpace(spaceId)).length
}

export const countFailedForSpace = async (
  spaceId: string,
): Promise<number> => {
  const failed = await syncEventRepository.listByStatus('FAILED')
  return failed.filter(forSpace(spaceId)).length
}

/** Re-queue every permanently-rejected event for another attempt. */
export const retryFailed = async (spaceId: string): Promise<number> => {
  const failed = (await syncEventRepository.listByStatus('FAILED')).filter(
    forSpace(spaceId),
  )
  for (const event of failed) {
    await syncEventRepository.setStatus(event.id, 'PENDING', null)
    await markLocalSyncStatus(
      event.entityType,
      event.entityId,
      'PENDING',
    ).catch(() => undefined)
  }
  return failed.length
}

/**
 * Give up on every permanently-rejected change: drop the queued events and
 * clear the local FAILED flag. The next pull reconciles those rows with the
 * server's version.
 */
export const discardFailed = async (spaceId: string): Promise<number> => {
  const failed = (await syncEventRepository.listByStatus('FAILED')).filter(
    forSpace(spaceId),
  )
  for (const event of failed) {
    await syncEventRepository.remove(event.id)
    await clearFailedFlag(event.entityType, event.entityId).catch(
      () => undefined,
    )
  }
  return failed.length
}
