import { attachmentRepository } from '../../repositories'
import { enqueueMutation } from '../sync/enqueue'
import type { MutationContext } from '../sync/context'
import type {
  Attachment,
  AttachmentEntityType,
} from '../../types/models'

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'application/pdf',
])

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

export const listAttachments = (
  entityType: AttachmentEntityType,
  entityId: string,
): Promise<Attachment[]> =>
  attachmentRepository.listForEntity(entityType, entityId)

/**
 * Store a receipt locally, linked to a record. It lives in IndexedDB as a Blob
 * and is queued for upload; it stays usable offline and across restarts
 * (Architecture §28, Roadmap Phase 13).
 */
export const addAttachment = async (
  ctx: MutationContext,
  input: {
    entityType: AttachmentEntityType
    entityId: string
    file: File
  },
): Promise<Attachment> => {
  if (!ALLOWED_MIME.has(input.file.type)) {
    throw new Error('Only images and PDF files are allowed')
  }
  if (input.file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error('File is larger than 10 MB')
  }

  const blob = new Blob([await input.file.arrayBuffer()], {
    type: input.file.type,
  })

  const attachment = await attachmentRepository.create({
    ownerId: ctx.userId,
    spaceId: ctx.spaceId,
    entityType: input.entityType,
    entityId: input.entityId,
    fileName: input.file.name.slice(0, 260),
    mimeType: input.file.type,
    size: input.file.size,
    storageKey: null,
    localStatus: 'STORED',
    syncStatus: 'PENDING',
    blob,
    createdBy: ctx.userId,
  })

  // Don't ship the blob through the sync-event payload; it's read from the store.
  await enqueueMutation(ctx, 'attachment', attachment.id, 'CREATE', {
    id: attachment.id,
    entityType: attachment.entityType,
    entityId: attachment.entityId,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    size: attachment.size,
  })

  return attachment
}

/** An object URL for previewing an attachment. Caller must revoke it. */
export const getAttachmentUrl = async (
  id: string,
): Promise<string | null> => {
  const blob = await attachmentRepository.getBlob(id)
  return blob ? URL.createObjectURL(blob) : null
}

export const removeAttachment = async (
  ctx: MutationContext,
  id: string,
): Promise<void> => {
  await attachmentRepository.softDelete(id)
  await enqueueMutation(ctx, 'attachment', id, 'DELETE', { id })
}
