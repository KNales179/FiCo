import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import { useMutationContext } from '../hooks/useMutationContext'
import {
  addAttachment,
  getAttachmentUrl,
  listAttachments,
  removeAttachment,
} from '../features/attachments'
import type {
  Attachment,
  AttachmentEntityType,
} from '../types/models'

const Thumb = ({ attachment }: { attachment: Attachment }) => {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let revoked: string | null = null
    void getAttachmentUrl(attachment.id).then((u) => {
      revoked = u
      setUrl(u)
    })
    return () => {
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [attachment.id])

  if (!url) {
    return <span className="text-xs text-gray-400">{attachment.fileName}</span>
  }

  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      {attachment.mimeType.startsWith('image/') ? (
        <img
          src={url}
          alt={attachment.fileName}
          className="h-16 w-16 rounded border object-cover"
        />
      ) : (
        <span className="text-xs text-blue-700 underline">
          {attachment.fileName}
        </span>
      )}
    </a>
  )
}

/**
 * Receipts for one record. Local-first: files are stored in IndexedDB and
 * queued for upload, so they work offline and survive restarts (§18, §28).
 */
const Attachments = ({
  entityType,
  entityId,
}: {
  entityType: AttachmentEntityType
  entityId: string
}) => {
  const { ctx, canEdit } = useMutationContext()
  const [items, setItems] = useState<Attachment[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setItems(await listAttachments(entityType, entityId))
  }, [entityType, entityId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const onPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !ctx) return

    setBusy(true)
    setError('')
    try {
      await addAttachment(ctx, { entityType, entityId, file })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not attach file')
    } finally {
      setBusy(false)
    }
  }

  const onRemove = async (id: string) => {
    if (!ctx) return
    await removeAttachment(ctx, id)
    await load()
  }

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-start gap-2">
        {items.map((att) => (
          <div key={att.id} className="flex flex-col items-center gap-1">
            <Thumb attachment={att} />
            {canEdit && (
              <button
                type="button"
                onClick={() => void onRemove(att.id)}
                className="text-[10px] text-muted underline"
              >
                remove
              </button>
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="mt-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => void onPick(e)}
            hidden
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="text-xs text-muted underline disabled:opacity-50"
          >
            {busy ? 'attaching…' : '+ receipt'}
          </button>
          {error && (
            <span className="ml-2 text-xs text-danger">{error}</span>
          )}
        </div>
      )}
    </div>
  )
}

export default Attachments
