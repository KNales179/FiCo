import { api } from '../lib/api'
import { isDemoMode } from '../features/demo/demoMode'
import { demoActionLogs } from '../features/demo/activity'

export interface ActionLogEntry {
  id: string
  actorId: string
  actorName: string | null
  action: string
  entityType: string
  entityId: string
  summary: string
  createdAt: string
  /** What an edit changed — empty for adds, deletes, and older entries. */
  changes?: Array<{ field: string; from: unknown; to: unknown }>
}

interface ActionLogResponse {
  success: boolean
  logs: ActionLogEntry[]
  nextBefore: string | null
}

export const fetchActionLogs = (
  spaceId: string,
  options: {
    limit?: number
    before?: string
    /** Activity tab: records, members, or conflicts. */
    group?: 'records' | 'members' | 'conflicts'
    /** Records tab: money, bills, tobuy, or planning. */
    kind?: string
  } = {},
) => {
  // The demo never talks to the server: it has its own sample history.
  if (isDemoMode()) {
    return Promise.resolve<ActionLogResponse>({ success: true, logs: demoActionLogs(options), nextBefore: null })
  }
  const params = new URLSearchParams()
  if (options.limit) params.set('limit', String(options.limit))
  if (options.before) params.set('before', options.before)
  if (options.group) params.set('group', options.group)
  if (options.kind) params.set('kind', options.kind)
  const qs = params.toString()
  return api<ActionLogResponse>(
    `/spaces/${spaceId}/action-logs${qs ? `?${qs}` : ''}`,
  )
}
