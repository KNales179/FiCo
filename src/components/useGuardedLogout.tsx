import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useSync } from '../hooks/useSync'
import { countUnsyncedChanges } from '../features/auth/localAuth'
import { Button, Modal } from './ui'
import { IconCloudOff } from './icons'

/**
 * "Log out" that never silently throws away work: if this device holds
 * changes the server doesn't have yet, it first tries to send them; if any
 * are still left (offline, or a change the server refused), it asks.
 */
export const useGuardedLogout = () => {
  const { logout, demo } = useAuth()
  const { syncNow } = useSync()
  const [unsynced, setUnsynced] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const request = async () => {
    if (demo) {
      await logout()
      return
    }
    setBusy(true)
    try {
      let count = await countUnsyncedChanges()
      if (count > 0 && navigator.onLine) {
        await syncNow().catch(() => undefined)
        count = await countUnsyncedChanges()
      }
      if (count === 0) await logout()
      else setUnsynced(count)
    } finally {
      setBusy(false)
    }
  }

  const dialog =
    unsynced !== null ? (
      <Modal title="Some changes haven’t synced yet" onClose={() => setUnsynced(null)}>
        <div className="mt-3 space-y-3 text-sm">
          <div className="flex items-start gap-3 rounded-xl bg-warning/10 px-3 py-2.5 text-ink">
            <IconCloudOff size={18} className="mt-0.5 shrink-0 text-warning" />
            <p>
              <span className="font-semibold">
                {unsynced} change{unsynced === 1 ? '' : 's'}
              </span>{' '}
              on this device {unsynced === 1 ? 'hasn’t' : 'haven’t'} reached the server yet
              {navigator.onLine ? ' (the server didn’t accept them, or is still waking up).' : ' — you’re offline.'}{' '}
              Logging out now deletes {unsynced === 1 ? 'it' : 'them'} from this device for good.
            </p>
          </div>
          <p className="text-muted">
            Stay signed in and they’ll sync on their own once you’re connected.
          </p>
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button onClick={() => setUnsynced(null)} variant="primary">
              Stay signed in
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setUnsynced(null)
                void logout()
              }}
            >
              Log out and delete them
            </Button>
          </div>
        </div>
      </Modal>
    ) : null

  return { requestLogout: request, logoutBusy: busy, logoutDialog: dialog }
}
