import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useMutationContext } from '../hooks/useMutationContext'
import { useConnectivity } from '../hooks/useConnectivity'
import { useAuth } from '../hooks/useAuth'
import { ApiError, isNetworkError } from '../lib/api'
import {
  forgetLocalAttachment,
  getLocalAttachmentBlob,
  listLocalAttachments,
  receiptFileProblem,
} from '../features/attachments'
import {
  deleteRemoteAttachment,
  listRemoteAttachments,
  uploadRemoteAttachment,
  type RemoteAttachment,
} from '../services/attachmentService'
import type { Attachment, AttachmentEntityType } from '../types/models'
import { IconCloudOff } from './icons'

/** A photo still only on this device (saved by an older version or the scanner). */
const LocalThumb = ({ attachment }: { attachment: Attachment }) => {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let made: string | null = null
    void getLocalAttachmentBlob(attachment.id).then((blob) => {
      if (!blob) return
      made = URL.createObjectURL(blob)
      setUrl(made)
    })
    return () => {
      if (made) URL.revokeObjectURL(made)
    }
  }, [attachment.id])
  return <Preview url={url} name={attachment.fileName} mime={attachment.mimeType} note="waiting to upload" />
}

const Preview = ({ url, name, mime, note }: { url: string | null; name: string; mime: string; note?: string }) => (
  <span className="flex flex-col items-center">
    {!url ? (
      <span className="flex h-16 w-16 items-center justify-center rounded border border-line text-[10px] text-muted">
        {name.slice(0, 14)}
      </span>
    ) : (
      <a href={url} target="_blank" rel="noreferrer" className="block">
        {mime.startsWith('image/') ? (
          <img src={url} alt={name} className="h-16 w-16 rounded border border-line object-cover" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded border border-line text-xs text-brand underline">
            PDF
          </span>
        )}
      </a>
    )}
    {note && <span className="mt-0.5 text-[10px] text-muted">{note}</span>}
  </span>
)

/**
 * Receipt photos for one record. Online, they upload straight to the
 * server, so everyone in the Finance can see them. Offline, attaching is
 * turned off (there's nothing to upload to) — the record itself still saves
 * and syncs as usual.
 */
const Attachments = ({ entityType, entityId }: { entityType: AttachmentEntityType; entityId: string }) => {
  const { ctx, canEdit } = useMutationContext()
  const { demo } = useAuth()
  const { navigatorOnline } = useConnectivity()
  const online = navigatorOnline && !demo
  const [remote, setRemote] = useState<RemoteAttachment[]>([])
  const [local, setLocal] = useState<Attachment[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const spaceId = ctx?.spaceId

  const load = useCallback(async () => {
    const mine = await listLocalAttachments(entityType, entityId)
    setLocal(mine)
    if (!spaceId || !online) return
    try {
      // Photos an older version kept only on this device go up now.
      for (const a of mine) {
        const blob = await getLocalAttachmentBlob(a.id)
        if (!blob) continue
        try {
          await uploadRemoteAttachment(spaceId, { entityType, entityId, file: blob, fileName: a.fileName, clientId: a.id })
          await forgetLocalAttachment(a.id)
        } catch {
          // Leave it; it'll try again later.
        }
      }
      const res = await listRemoteAttachments(spaceId, entityType, entityId)
      setRemote(res.attachments)
      setLocal(await listLocalAttachments(entityType, entityId))
    } catch {
      // Offline or the server is waking — what's on the device still shows.
    }
  }, [entityType, entityId, spaceId, online])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const onPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !spaceId) return
    const problem = receiptFileProblem(file)
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await uploadRemoteAttachment(spaceId, { entityType, entityId, file, fileName: file.name })
      setRemote((list) => [res.attachment, ...list])
    } catch (err) {
      setError(
        isNetworkError(err)
          ? 'Couldn’t reach the server — attach it again once you’re back online.'
          : err instanceof ApiError && err.code === 'RECORD_NOT_SYNCED'
            ? 'This record is still syncing — try again in a moment.'
            : err instanceof Error
              ? err.message
              : 'Could not attach the file',
      )
    } finally {
      setBusy(false)
    }
  }

  const removeRemote = async (id: string) => {
    if (!spaceId) return
    setError('')
    try {
      await deleteRemoteAttachment(spaceId, id)
      setRemote((list) => list.filter((a) => a.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove it')
    }
  }

  const removeLocal = async (id: string) => {
    await forgetLocalAttachment(id)
    setLocal((list) => list.filter((a) => a.id !== id))
  }

  const nothing = remote.length === 0 && local.length === 0

  return (
    <div className="mt-2">
      {!nothing && (
        <div className="flex flex-wrap items-start gap-2">
          {remote.map((att) => (
            <div key={att.id} className="flex flex-col items-center gap-1">
              <Preview url={att.url} name={att.fileName} mime={att.mimeType} />
              {canEdit && online && (
                <button type="button" onClick={() => void removeRemote(att.id)} className="text-[10px] text-muted underline">
                  remove
                </button>
              )}
            </div>
          ))}
          {local.map((att) => (
            <div key={att.id} className="flex flex-col items-center gap-1">
              <LocalThumb attachment={att} />
              {canEdit && (
                <button type="button" onClick={() => void removeLocal(att.id)} className="text-[10px] text-muted underline">
                  remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="mt-1">
          <input ref={inputRef} type="file" accept="image/*,application/pdf" onChange={(e) => void onPick(e)} hidden />
          {online ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="text-xs text-muted underline disabled:opacity-50"
            >
              {busy ? 'uploading…' : '+ receipt'}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-muted" title="Receipt photos upload to the server">
              <IconCloudOff size={12} />
              {demo ? 'Receipt photos aren’t available in the demo' : 'Connect to the internet to attach a receipt photo'}
            </span>
          )}
          {error && <span className="ml-2 text-xs text-danger">{error}</span>}
        </div>
      )}
    </div>
  )
}

export default Attachments
