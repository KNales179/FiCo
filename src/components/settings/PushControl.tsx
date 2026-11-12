import { useCallback, useEffect, useState } from 'react'
import {
  disablePush,
  enablePush,
  getCurrentPushSubscription,
  isPushSupported,
} from '../../features/push'
import { ensureDeviceId } from '../../features/auth/localAuth'
import { Button } from '../ui'

type PushStatus = 'checking' | 'unsupported' | 'off' | 'on' | 'blocked'

/**
 * Turn real (push) notifications on or off for this device. Lives in
 * Settings → Notifications next to what to be notified about — it used to
 * sit on the Account page, where nobody found it.
 */
const PushControl = () => {
  const [status, setStatus] = useState<PushStatus>('checking')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const check = useCallback(async () => {
    if (!isPushSupported()) {
      setStatus('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setStatus('blocked')
      return
    }
    const subscription = await getCurrentPushSubscription()
    setStatus(subscription ? 'on' : 'off')
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void check()
  }, [check])

  const turnOn = async () => {
    setError('')
    setBusy(true)
    try {
      const deviceId = await ensureDeviceId().catch(() => undefined)
      const result = await enablePush(deviceId)
      if (!result.ok) {
        setError(
          result.reason === 'permission-denied'
            ? "Notifications are blocked for Fico in your browser's settings"
            : result.reason === 'not-configured'
              ? 'The server has not set up push notifications yet'
              : "This browser doesn't support push notifications",
        )
      }
      await check()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not turn on notifications')
    } finally {
      setBusy(false)
    }
  }

  const turnOff = async () => {
    setError('')
    setBusy(true)
    try {
      await disablePush()
      await check()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not turn off notifications')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel-2 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">Notifications on this device</p>
        <p className="text-xs text-muted">
          {status === 'checking' && 'Checking…'}
          {status === 'unsupported' && "This browser can't show push notifications."}
          {status === 'blocked' && 'Blocked in your browser — allow notifications for this site to turn them on.'}
          {status === 'on' && 'On — bill reminders and Finance activity arrive even when Fico is closed.'}
          {status === 'off' && 'Off — turn on to get reminders even when Fico is closed.'}
        </p>
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </div>
      {status === 'on' && (
        <Button size="sm" onClick={() => void turnOff()} disabled={busy}>
          {busy ? 'Turning off…' : 'Turn off'}
        </Button>
      )}
      {status === 'off' && (
        <Button size="sm" variant="primary" onClick={() => void turnOn()} disabled={busy}>
          {busy ? 'Turning on…' : 'Turn on'}
        </Button>
      )}
    </div>
  )
}

export default PushControl
