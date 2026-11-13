import { attachmentRepository, syncEventRepository } from '../../repositories'
import type { Attachment, AttachmentEntityType } from '../../types/models'

/**
 * Receipt photos/PDFs. They upload straight to the server while online (and
 * attaching is turned off offline — there's no offline photo queue). Photos
 * an older version kept only on this device are still listed from here and
 * get uploaded the next time their record is opened online.
 */

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'application/pdf',
])

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

/** Why this file can't be attached, or null if it can. */
export const receiptFileProblem = (file: File): string | null => {
  if (!ALLOWED_MIME.has(file.type)) return 'Only images and PDF files are allowed'
  if (file.size > MAX_ATTACHMENT_BYTES) return 'File is larger than 10 MB'
  return null
}

/** Photos saved on this device by an older version, not uploaded yet. */
export const listLocalAttachments = async (
  entityType: AttachmentEntityType,
  entityId: string,
): Promise<Attachment[]> =>
  (await attachmentRepository.listForEntity(entityType, entityId)).filter((a) => !a.deletedAt && a.blob)

export const getLocalAttachmentBlob = (id: string) => attachmentRepository.getBlob(id)

/** Drop a device-only copy (uploaded now, or removed) along with its old queue entries. */
export const forgetLocalAttachment = async (id: string): Promise<void> => {
  await attachmentRepository.hardDelete(id)
  const events = await syncEventRepository.listForEntity('attachment', id)
  for (const e of events) await syncEventRepository.remove(e.id)
}

/**
 * Keep a photo on this device for a record — used by the receipt scanner,
 * which works offline. It's uploaded by `uploadWaitingAttachments` once
 * the record itself has reached the server.
 */
export const saveReceiptLocally = async (
  ctx: { userId: string; spaceId: string },
  input: { entityType: AttachmentEntityType; entityId: string; file: File },
): Promise<Attachment> => {
  const problem = receiptFileProblem(input.file)
  if (problem) throw new Error(problem)
  const blob = new Blob([await input.file.arrayBuffer()], { type: input.file.type })
  return attachmentRepository.create({
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
}

/**
 * After a sync: upload every photo still waiting on this device. One whose
 * record hasn't reached the server yet (422), or that hit a network error,
 * simply waits for the next round. Returns how many went up.
 */
export const uploadWaitingAttachments = async (
  upload: (a: Attachment, blob: Blob) => Promise<void>,
): Promise<number> => {
  const waiting = (await attachmentRepository.listPendingUpload()).filter((a) => !a.deletedAt)
  let done = 0
  for (const a of waiting) {
    const blob = await attachmentRepository.getBlob(a.id)
    if (!blob) continue
    try {
      await upload(a, blob)
      await forgetLocalAttachment(a.id)
      done += 1
    } catch {
      // Try again after the next sync.
    }
  }
  return done
}
