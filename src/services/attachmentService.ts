import { api } from '../lib/api'
import type { AttachmentEntityType } from '../types/models'

export interface RemoteAttachment {
  id: string
  clientId: string | null
  entityType: AttachmentEntityType
  entityId: string
  fileName: string
  mimeType: string
  size: number
  createdBy: string
  createdAt: string
  /** Short-lived signed link to view it (null if storage isn't set up). */
  url: string | null
}

export const listRemoteAttachments = (spaceId: string, entityType: AttachmentEntityType, entityId: string) =>
  api<{ success: boolean; attachments: RemoteAttachment[] }>(
    `/spaces/${spaceId}/attachments?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}`,
  )

/** Upload a receipt photo/PDF for a record. `clientId` makes a retry safe (no duplicate). */
export const uploadRemoteAttachment = (
  spaceId: string,
  input: { entityType: AttachmentEntityType; entityId: string; file: Blob; fileName: string; clientId?: string },
) => {
  const form = new FormData()
  form.append('entityType', input.entityType)
  form.append('entityId', input.entityId)
  if (input.clientId) form.append('clientId', input.clientId)
  form.append('file', input.file, input.fileName)
  return api<{ success: boolean; attachment: RemoteAttachment }>(`/spaces/${spaceId}/attachments`, {
    method: 'POST',
    body: form,
    timeoutMs: 60_000,
  })
}

export const deleteRemoteAttachment = (spaceId: string, id: string) =>
  api<{ success: boolean }>(`/spaces/${spaceId}/attachments/${id}`, { method: 'DELETE' })
