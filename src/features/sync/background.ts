import { API_URL } from '../../lib/api'
import { syncEventRepository } from '../../repositories'
import { isDemoSpace } from '../demo/space'
import type { SyncEvent } from '../../types/models'

type SyncCapableRegistration = ServiceWorkerRegistration & {
  sync?: { register: (tag: string) => Promise<void> }
}

/**
 * Android / Chrome: ask the browser to run 'fico-sync' (see sw.ts) as soon
 * as there's a connection — even if Fico has been closed by then. Browsers
 * without Background Sync (iPhone) simply skip this.
 */
export const requestBackgroundSync = () => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  void navigator.serviceWorker.ready
    .then((reg) => (reg as SyncCapableRegistration).sync?.register('fico-sync'))
    .catch(() => undefined)
}

// Browsers cap a keepalive request's body at 64 KB; stay safely under.
const KEEPALIVE_BYTES = 60_000

/**
 * iPhone (and everyone else): the moment Fico is closed or sent to the
 * background, send what's waiting with `keepalive` requests — the browser
 * lets those finish after the page is gone. Nothing is lost if one doesn't
 * make it: the changes stay queued and go up on the next open, and the
 * server ignores any it already received (each change has a fixed id).
 */
export const flushOnLeave = async (deviceId: string): Promise<void> => {
  if (!navigator.onLine) return
  const pending = (await syncEventRepository.listPending()).filter(
    (e) => e.spaceId && !isDemoSpace(e.spaceId) && e.entityType !== 'attachment',
  )
  if (pending.length === 0) return

  const bySpace = new Map<string, SyncEvent[]>()
  for (const e of pending) bySpace.set(e.spaceId!, [...(bySpace.get(e.spaceId!) ?? []), e])

  for (const [spaceId, events] of bySpace) {
    let batch: unknown[] = []
    let size = 0
    const send = () => {
      if (batch.length === 0) return
      void fetch(`${API_URL}/spaces/${spaceId}/sync/push`, {
        method: 'POST',
        keepalive: true,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, events: batch }),
      }).catch(() => undefined)
      batch = []
      size = 0
    }
    for (const e of events) {
      const item = {
        id: e.id,
        entityType: e.entityType,
        entityId: e.entityId,
        operation: e.operation,
        payload: e.payload,
        clientVersion: e.clientVersion,
        ...(e.changedFields?.length ? { changedFields: e.changedFields } : {}),
      }
      const itemSize = JSON.stringify(item).length + 1
      if (itemSize > KEEPALIVE_BYTES) continue // too big for this route; the normal sync sends it
      if (size + itemSize > KEEPALIVE_BYTES) send()
      batch.push(item)
      size += itemSize
    }
    send()
  }
}
