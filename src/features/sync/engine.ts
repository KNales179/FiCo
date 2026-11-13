import { api, ApiError, isNetworkError } from '../../lib/api'
import { isDemoSpace } from '../demo/space'
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
  readLocalRecord,
} from './apply'
import { fitToServerLimits } from './limits'

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
  /** For `stale` (or a partly-kept edit): the server's current copy, which won. */
  record?: Record<string, unknown>
  /** Fields of the edit that lost to a newer change. */
  lostFields?: string[]
}

/**
 * Something the person should hear about from a sync: a change the server
 * refused, or an offline edit (or part of one) replaced by a newer change.
 * Carries the change itself, so its details are never lost.
 */
export interface SyncIssue {
  kind: 'REJECTED' | 'OVERWRITTEN'
  spaceId: string
  entityType: string
  entityId: string
  operation: string
  /** What this device tried to save. */
  attempted: Record<string, unknown>
  /** OVERWRITTEN: the copy that was kept. */
  kept?: Record<string, unknown>
  /** OVERWRITTEN: which of the edit's fields lost (absent = the whole edit). */
  lostFields?: string[]
  reason?: string
}

const asRecord = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})

// Kept in the device database (not memory) — a background sync run by the
// service worker finds them too, and the app shows them next time it's open.
const ISSUES_KEY = 'sync.issues'
let lastIssues: SyncIssue[] = []
const saveIssues = async () => {
  if (lastIssues.length === 0) return
  const existing = (await metadataRepository.get<SyncIssue[]>(ISSUES_KEY)) ?? []
  await metadataRepository.set(ISSUES_KEY, [...existing, ...lastIssues].slice(-100))
  lastIssues = []
}

/** Rejected / overwritten changes not shown to the person yet (and forget them). */
export const takeSyncIssues = async (): Promise<SyncIssue[]> => {
  const issues = (await metadataRepository.get<SyncIssue[]>(ISSUES_KEY)) ?? []
  if (issues.length) await metadataRepository.remove(ISSUES_KEY)
  return issues
}

/** Set when a push brought back a newer server copy — the screens should refresh. */
let staleApplied = false
export const takeStaleApplied = () => {
  const was = staleApplied
  staleApplied = false
  return was
}

const cursorKey = (spaceId: string) => `sync.cursor.${spaceId}`
const pulledAtKey = (spaceId: string) => `sync.pulledAt.${spaceId}`

/** When this Finance last got fresh data from the server — and whether it ever has on this device. */
export const spaceSyncInfo = async (spaceId: string): Promise<{ pulledAt: string | null; downloaded: boolean }> => {
  const [pulledAt, cursor] = await Promise.all([
    metadataRepository.get<string>(pulledAtKey(spaceId)),
    metadataRepository.get<string>(cursorKey(spaceId)),
  ])
  return { pulledAt: pulledAt ?? null, downloaded: Boolean(cursor) }
}

/**
 * Push every pending local mutation — for *every* Finance on this device,
 * not just the one open right now. (Only pushing the active one meant
 * offline changes to, say, a personal Finance sat unsent for as long as
 * the family one was open.) Each Finance goes to its own endpoint.
 */
export const pushPending = async (
  ctx: MutationContext,
): Promise<{ pushed: number; rejected: number }> => {
  const pending = (await syncEventRepository.listPending()).filter(
    (e) =>
      Boolean(e.spaceId) &&
      !isDemoSpace(e.spaceId) &&
      // Attachment blobs sync separately (not yet wired).
      e.entityType !== 'attachment',
  )
  if (pending.length === 0) return { pushed: 0, rejected: 0 }

  // Active Finance first, then the rest — each in creation order.
  const bySpace = new Map<string, SyncEvent[]>()
  for (const e of pending) {
    const list = bySpace.get(e.spaceId!) ?? []
    list.push(e)
    bySpace.set(e.spaceId!, list)
  }
  const order = [...bySpace.keys()].sort((a, b) => (a === ctx.spaceId ? -1 : b === ctx.spaceId ? 1 : 0))

  let pushed = 0
  let rejected = 0
  try {
    for (const spaceId of order) {
      const result = await pushSpace(ctx, spaceId, bySpace.get(spaceId)!)
      pushed += result.pushed
      rejected += result.rejected
    }
  } finally {
    await saveIssues()
  }
  return { pushed, rejected }
}

/**
 * A queued change whose payload isn't a whole record (older app versions
 * queued shopping check-offs as just `{ id, checked }`, which the server
 * refuses) is filled in from this device's current copy before sending.
 */
const completePayload = async (event: SyncEvent): Promise<SyncEvent> => {
  if (event.operation === 'DELETE') return event
  const payload = event.payload as Record<string, unknown> | null
  if (payload && typeof payload === 'object' && 'spaceId' in payload) return event
  const local = await readLocalRecord(event.entityType, event.entityId)
  if (!local) return event
  const fixed = fitToServerLimits(event.entityType, local)
  await syncEventRepository.setPayload(event.id, fixed)
  return { ...event, payload: fixed }
}

/** Once per app start: give changes that failed only because of that old bug another go. */
export const requeueRepairableFailures = async (): Promise<number> => {
  const failed = await syncEventRepository.listByStatus('FAILED')
  let count = 0
  for (const event of failed) {
    if (event.operation !== 'CHECK' && event.operation !== 'UNCHECK') continue
    const payload = event.payload as Record<string, unknown> | null
    if (payload && 'spaceId' in payload) continue
    await syncEventRepository.setStatus(event.id, 'PENDING', null)
    await markLocalSyncStatus(event.entityType, event.entityId, 'PENDING').catch(() => undefined)
    count += 1
  }
  return count
}

const pushSpace = async (
  ctx: MutationContext,
  spaceId: string,
  queued: SyncEvent[],
): Promise<{ pushed: number; rejected: number }> => {
  let pushed = 0
  let rejected = 0
  const pending: SyncEvent[] = []
  for (const e of queued) pending.push(await completePayload(e))

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
        ...(e.changedFields?.length ? { changedFields: e.changedFields } : {}),
      })),
    }

    let res: { success: boolean; results: PushResult[] }
    try {
      res = await api<{ success: boolean; results: PushResult[] }>(`/spaces/${spaceId}/sync/push`, {
        method: 'POST',
        body,
      })
    } catch (error) {
      // No longer a member of this Finance (or it was deleted): retrying
      // forever can't help — mark these as failed, with the reason, so the
      // person sees them and can discard them.
      if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
        for (const e of slice) {
          await syncEventRepository.setStatus(
            e.id,
            'FAILED',
            error.status === 404 ? 'That Finance no longer exists' : 'You no longer have access to that Finance',
          )
          await markLocalSyncStatus(e.entityType, e.entityId, 'FAILED')
          lastIssues.push({
            kind: 'REJECTED',
            spaceId,
            entityType: e.entityType,
            entityId: e.entityId,
            operation: e.operation,
            attempted: asRecord(e.payload),
            reason: error.status === 404 ? 'That Finance no longer exists' : 'You no longer have access to that Finance',
          })
        }
        rejected += slice.length
        continue
      }
      throw error
    }

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
          lastIssues.push({
            kind: 'REJECTED',
            spaceId,
            entityType: event.entityType,
            entityId: event.entityId,
            operation: event.operation,
            attempted: asRecord(event.payload),
            reason: result.message ?? 'Rejected by the server',
          })
        }
        rejected += 1
      } else {
        // applied / conflict-resolved / duplicate / stale — the event is done.
        await syncEventRepository.remove(result.eventId)
        // Lost to a newer version (e.g. edited elsewhere, or this phone's
        // clock is behind): take the server's copy so both sides agree.
        if ((result.status === 'stale' || result.lostFields?.length) && result.record && event) {
          await applyRemoteRecord(event.entityType, result.record, (result.record.deletedAt as string | null) ?? null)
          staleApplied = true
          lastIssues.push({
            kind: 'OVERWRITTEN',
            spaceId,
            entityType: event.entityType,
            entityId: event.entityId,
            operation: event.operation,
            attempted: asRecord(event.payload),
            kept: result.record,
            lostFields: result.lostFields,
          })
        }
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

  const now = new Date().toISOString()
  await metadataRepository.set(MetadataKeys.lastSyncAt, now)
  await metadataRepository.set(pulledAtKey(ctx.spaceId), now)
  return { applied }
}

export interface SyncOutcome {
  ok: boolean
  pushed: number
  rejected: number
  applied: number
  offline: boolean
  error?: string
  /** HTTP status when the server refused the whole sync (e.g. 401: signed out). */
  status?: number
}

/** One full sync cycle: push, then pull. */
export const runSync = async (
  ctx: MutationContext,
  otherSpaceIds: string[] = [],
): Promise<SyncOutcome> => {
  try {
    const { pushed, rejected } = await pushPending(ctx)
    const { applied } = await pull(ctx)
    // Keep every other Finance on this device up to date too, so one never
    // opened online isn't empty offline. A problem with one doesn't stop
    // the rest (or the sync of the Finance that's open).
    for (const spaceId of otherSpaceIds) {
      if (spaceId === ctx.spaceId || isDemoSpace(spaceId)) continue
      try {
        await pull({ ...ctx, spaceId })
      } catch (error) {
        if (isNetworkError(error)) throw error
      }
    }
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
      status: err instanceof ApiError ? err.status : undefined,
    }
  }
}

// Counts and retry/discard cover every Finance on this device — a change
// waiting in another Finance is still a change waiting.
const syncable = (e: { spaceId?: string | null; entityType: string }) =>
  Boolean(e.spaceId) && !isDemoSpace(e.spaceId) && e.entityType !== 'attachment'

/**
 * What a queued change counts as, for the "N changes waiting" number — one
 * per thing the person actually did. A finished shopping trip writes a
 * list, its items, saved items and price records; that's one change, not
 * ten. Behind-the-scenes records (default categories, price history…)
 * don't count on their own.
 */
const thingOf = (e: SyncEvent): string | null => {
  const payload = (e.payload ?? {}) as Record<string, unknown>
  switch (e.entityType) {
    case 'itemProfile':
    case 'priceHistory':
    case 'electricityRecord':
      return null
    case 'category':
      return e.entityId.startsWith('default-') ? null : `category:${e.entityId}`
    case 'shoppingItem':
      return payload.shoppingListId ? `shoppingList:${payload.shoppingListId as string}` : `shoppingItem:${e.entityId}`
    default:
      return `${e.entityType}:${e.entityId}`
  }
}

const countThings = (events: SyncEvent[]): number => {
  const list = events.filter(syncable)
  if (list.length === 0) return 0
  const things = new Set(list.map(thingOf).filter((k): k is string => Boolean(k)))
  return Math.max(1, things.size)
}

/** Pending changes across every Finance on this device. */
export const countPendingForSpace = async (): Promise<number> => {
  return countThings(await syncEventRepository.listPending())
}

export const countFailedForSpace = async (): Promise<number> => {
  return countThings(await syncEventRepository.listByStatus('FAILED'))
}

/** Re-queue every permanently-rejected event for another attempt. */
export const retryFailed = async (): Promise<number> => {
  const failed = (await syncEventRepository.listByStatus('FAILED')).filter(
    syncable,
  )
  for (const event of failed) {
    // Retry with the record as it is *now* on this device, not as it was
    // when the change was first queued.
    if (event.operation !== 'DELETE') {
      const local = await readLocalRecord(event.entityType, event.entityId)
      if (local) await syncEventRepository.setPayload(event.id, fitToServerLimits(event.entityType, local))
    }
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
export const discardFailed = async (): Promise<number> => {
  const failed = (await syncEventRepository.listByStatus('FAILED')).filter(
    syncable,
  )
  for (const event of failed) {
    await syncEventRepository.remove(event.id)
    await clearFailedFlag(event.entityType, event.entityId).catch(
      () => undefined,
    )
  }
  return failed.length
}
