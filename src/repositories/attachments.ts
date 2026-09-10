import type {
  Attachment,
  AttachmentEntityType,
} from '../types/models'
import { createRepository } from './createRepository'

const attachments = createRepository('attachments')

export const attachmentRepository = {
  ...attachments,

  async listForEntity(
    entityType: AttachmentEntityType,
    entityId: string,
  ): Promise<Attachment[]> {
    return attachments.getAllByIndex('by-entity', [entityType, entityId])
  },

  async listBySpace(spaceId: string): Promise<Attachment[]> {
    return attachments.getAllByIndex('by-spaceId', spaceId)
  },

  /** Attachments whose bytes are stored locally but not yet uploaded (§28). */
  async listPendingUpload(): Promise<Attachment[]> {
    const rows = await attachments.getAllByIndex(
      'by-syncStatus',
      'PENDING',
    )
    return rows.filter((a) => a.localStatus === 'STORED')
  },

  async getBlob(id: string): Promise<Blob | undefined> {
    const record = await attachments.get(id)
    return record?.blob
  },
}
