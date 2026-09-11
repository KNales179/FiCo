import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import {
  changePassword,
  confirmTwoFactorSetup,
  disableTwoFactor,
  listMySessions,
  revokeMySession,
  startTwoFactorSetup,
} from '../services/authService'
import { isNetworkError } from '../lib/api'
import type { DeviceSession } from '../types/auth'
import { PageHeader, Card, Button, Input, Alert } from '../components/ui'

const formatDate = (iso: string) => new Date(iso).toLocaleString()

const PasswordSection = () => {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSaved(false)
    setBusy(true)
    try {
      await changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <h2 className="section-title">Change password</h2>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <Input
          type="password"
          placeholder="Current password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="New password (min. 8 characters)"
          autoComplete="new-password"
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        {error && <Alert>{error}</Alert>}
        {saved && <p className="text-sm text-success">Password changed.</p>}
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Saving…' : 'Change password'}
        </Button>
      </form>
    </Card>
  )
}

const DevicesSection = () => {
  const [sessions, setSessions] = useState<DeviceSession[] | null>(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await listMySessions()
      setSessions(res.sessions)
    } catch (err) {
      setError(
        isNetworkError(err)
          ? 'Devices are unavailable offline'
          : err instanceof Error
            ? err.message
            : 'Could not load devices',
      )
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const revoke = async (session: DeviceSession) => {
    if (
      !window.confirm(
        session.isCurrent
          ? 'Sign this device out? You are using it right now — you will need to log in again.'
          : 'Sign this device out?',
      )
    )
      return
    setBusyId(session.id)
    try {
      await revokeMySession(session.id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign out that device')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card>
      <h2 className="section-title">Your devices</h2>
      <p className="mt-1 text-xs text-muted">
        Everywhere your account is currently signed in. Don't recognize one? Sign it out.
      </p>
      {error && <Alert>{error}</Alert>}
      {sessions === null && !error && <p className="mt-2 text-sm text-muted">Loading…</p>}
      {sessions && (
        <ul className="mt-2 divide-y divide-line">
          {sessions.length === 0 && (
            <li className="py-1.5 text-sm text-muted">Nothing to show.</li>
          )}
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span>
                {s.userAgent || 'Unknown device'}
                {s.isCurrent && (
                  <span className="ml-2 text-xs font-medium text-brand">this device</span>
                )}
                <span className="mt-0.5 block text-xs text-muted">
                  last active {formatDate(s.lastUsedAt)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void revoke(s)}
                disabled={busyId === s.id}
                className="text-xs text-muted underline hover:text-danger disabled:opacity-50"
              >
                {busyId === s.id ? 'signing out…' : 'sign out'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/** Only ever shown to an admin — 2FA is enforced for that role specifically. */
const TwoFactorSection = () => {
  const { user, refreshUser } = useAuth()
  const [step, setStep] = useState<'idle' | 'settingUp' | 'confirmed' | 'disabling'>('idle')
  const [secret, setSecret] = useState('')
  const [uri, setUri] = useState('')
  const [code, setCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [disablePassword, setDisablePassword] = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const beginSetup = async () => {
    setError('')
    setBusy(true)
    try {
      const res = await startTwoFactorSetup()
      setSecret(res.secret)
      setUri(res.uri)
      setStep('settingUp')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start setup')
    } finally {
      setBusy(false)
    }
  }

  const confirmSetup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await confirmTwoFactorSetup(code)
      setBackupCodes(res.backupCodes)
      setStep('confirmed')
      setCode('')
      await refreshUser()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code')
    } finally {
      setBusy(false)
    }
  }

  const submitDisable = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await disableTwoFactor(disablePassword, disableCode)
      setStep('idle')
      setDisablePassword('')
      setDisableCode('')
      await refreshUser()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not turn off 2FA')
    } finally {
      setBusy(false)
    }
  }

  if (user?.role !== 'ADMIN') return null

  return (
    <Card>
      <h2 className="section-title">Two-factor authentication</h2>
      <p className="mt-1 text-xs text-muted">
        Required to actually log in once it's on — admin accounts are worth
        the extra step.
      </p>

      {error && <Alert>{error}</Alert>}

      {step === 'idle' && (
        <div className="mt-3">
          {user.totpEnabled ? (
            <>
              <p className="text-sm text-success">2FA is on.</p>
              <Button
                className="mt-2"
                onClick={() => setStep('disabling')}
                disabled={busy}
              >
                Turn off 2FA
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-warning">2FA is off.</p>
              <Button
                variant="primary"
                className="mt-2"
                onClick={() => void beginSetup()}
                disabled={busy}
              >
                Turn on 2FA
              </Button>
            </>
          )}
        </div>
      )}

      {step === 'settingUp' && (
        <form onSubmit={confirmSetup} className="mt-3 space-y-3">
          <p className="text-sm">
            Add this key to an authenticator app (Google Authenticator, Authy,
            1Password, …), then enter the 6-digit code it shows.
          </p>
          <div className="rounded-lg border border-line bg-panel-2 p-3">
            <p className="break-all font-mono text-sm">{secret}</p>
            <p className="mt-2 break-all text-xs text-muted">{uri}</p>
          </div>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            placeholder="6-digit code"
            autoFocus
            required
          />
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? 'Confirming…' : 'Confirm'}
            </Button>
            <Button type="button" onClick={() => setStep('idle')}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {step === 'confirmed' && backupCodes && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-success">
            2FA is on. Save these backup codes somewhere safe — each works
            once, if you ever lose access to your authenticator app. They
            won't be shown again.
          </p>
          <ul className="grid grid-cols-2 gap-1.5 rounded-lg border border-line bg-panel-2 p-3 font-mono text-sm">
            {backupCodes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <Button variant="primary" onClick={() => setStep('idle')}>
            I've saved these
          </Button>
        </div>
      )}

      {step === 'disabling' && (
        <form onSubmit={submitDisable} className="mt-3 space-y-3">
          <p className="text-sm text-muted">
            Confirm with your password and a current code (or a backup code).
          </p>
          <Input
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={disablePassword}
            onChange={(e) => setDisablePassword(e.target.value)}
            required
          />
          <Input
            value={disableCode}
            onChange={(e) => setDisableCode(e.target.value)}
            placeholder="6-digit code or backup code"
            required
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? 'Turning off…' : 'Turn off 2FA'}
            </Button>
            <Button type="button" onClick={() => setStep('idle')}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Card>
  )
}

const Account = () => {
  const { user } = useAuth()

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title="Account"
        description={user ? `Signed in as ${user.username}` : undefined}
      />
      <PasswordSection />
      <DevicesSection />
      <TwoFactorSection />
    </div>
  )
}

export default Account
