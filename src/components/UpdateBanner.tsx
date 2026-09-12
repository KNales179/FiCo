import { useEffect, useState } from 'react'
import { applyPendingUpdate, SW_UPDATE_EVENT } from '../features/pwa/swUpdate'
import { Modal, Button } from './ui'
import { IconRotateCcw } from './icons'

/**
 * Tells a person a new version is ready instead of silently reloading out
 * from under them — the reload only happens once they click "Install
 * update" (owner feedback: an unannounced reload was losing in-progress
 * typing). Shown as a real dialog rather than a thin bar, so it reads as
 * what it is — a downloaded update waiting to be installed — and is hard
 * to miss on an installed PWA's launch (owner: "opening the app will say
 * the new update and ask for installing the download").
 */
const UpdateBanner = () => {
  const [available, setAvailable] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    const onAvailable = () => setAvailable(true)
    window.addEventListener(SW_UPDATE_EVENT, onAvailable)
    return () => window.removeEventListener(SW_UPDATE_EVENT, onAvailable)
  }, [])

  if (!available || dismissed) return null

  return (
    <Modal title="Update available" onClose={() => setDismissed(true)}>
      <p className="text-sm text-muted">
        A new version of Fico has already downloaded in the background and
        is ready to install. Installing restarts the app — save anything
        you're in the middle of typing first.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={() => setDismissed(true)} disabled={applying}>
          Not now
        </Button>
        <Button
          variant="primary"
          disabled={applying}
          onClick={() => {
            setApplying(true)
            void applyPendingUpdate()
          }}
        >
          <IconRotateCcw size={15} />
          {applying ? 'Installing…' : 'Install update'}
        </Button>
      </div>
    </Modal>
  )
}

export default UpdateBanner
