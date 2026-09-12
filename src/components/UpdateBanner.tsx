import { useEffect, useState } from 'react'
import { applyPendingUpdate, SW_UPDATE_EVENT } from '../features/pwa/swUpdate'

/**
 * Tells a person a new version is ready instead of silently reloading out
 * from under them — the reload only happens once they click "Refresh now"
 * (owner feedback: an unannounced reload was losing in-progress typing).
 */
const UpdateBanner = () => {
  const [available, setAvailable] = useState(false)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    const onAvailable = () => setAvailable(true)
    window.addEventListener(SW_UPDATE_EVENT, onAvailable)
    return () => window.removeEventListener(SW_UPDATE_EVENT, onAvailable)
  }, [])

  if (!available) return null

  return (
    <div
      role="status"
      className="flex w-full items-center justify-center gap-3 bg-brand px-4 py-1.5 text-center text-sm font-medium text-brand-ink"
    >
      <span>A new version of Fico is ready.</span>
      <button
        type="button"
        disabled={applying}
        onClick={() => {
          setApplying(true)
          void applyPendingUpdate()
        }}
        className="rounded-md bg-brand-ink/15 px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-brand-ink/25 disabled:opacity-50"
      >
        {applying ? 'Updating…' : 'Refresh now'}
      </button>
    </div>
  )
}

export default UpdateBanner
