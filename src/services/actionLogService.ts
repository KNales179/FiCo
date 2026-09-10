import { api } from '../lib/api'

export interface ActionLogEntry {
  id: string
  actorId: string
  actorName: string | null
  action: string
  entityType: string
  entityId: string
  summary: string
  createdAt: string
}

interface ActionLogResponse {
  success: boolean
  logs: ActionLogEntry[]
  nextBefore: string | null
}

export const fetchActionLogs = (
  spaceId: string,
  options: { limit?: number; before?: string } = {},
) => {
  const params = new URLSearchParams()
  if (options.limit) params.set('limit', String(options.limit))
  if (options.before) params.set('before', options.before)
  const qs = params.toString()
  return api<ActionLogResponse>(
    `/spaces/${spaceId}/action-logs${qs ? `?${qs}` : ''}`,
  )
}
