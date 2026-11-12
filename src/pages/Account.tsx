import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import {
  changePassword,
  confirmTwoFactorSetup,
  deleteAvatar,
  disableTwoFactor,
  listMySessions,
  resendVerificationEmail,
  revokeMySession,
  startTwoFactorSetup,
  uploadAvatar,
} from '../services/authService'
import { isNetworkError } from '../lib/api'
import { detectBrowser, installGuideFor, type BrowserKind } from '../features/pwa/installGuide'
import type { DeviceSession } from '../types/auth'
import { PageHeader, Card, Button, Input, Alert, SkeletonRow } from '../components/ui'
import {
  IconCamera,
  IconDownload,
  IconChevronDown,
  IconLogOut,
  IconTrash,
  IconX,
  IconUserCircle,
} from '../components/icons'
import {
  installPlatform,
  isRunningInstalled,
  onInstallAvailabilityChange,
  promptInstall,
  type InstallPlatform,
} from '../features/pwa/installPrompt'

const formatDate = (iso: string) => new Date(iso).toLocaleString()

const MAX_AVATAR_BYTES = 5 * 1024 * 1024

/** A profile picture — shown here, and anywhere else in Fico a member is listed. */
const AvatarSection = () => {
  const { user, refreshUser } = useAuth()
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const initial = (user?.displayName || user?.username || '?').charAt(0).toUpperCase()

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > MAX_AVATAR_BYTES) {
      setError('Image is larger than 5 MB')
      return
    }
    void upload(file)
  }

  const upload = async (file: File) => {
    setError('')
    setBusy(true)
    try {
      await uploadAvatar(file)
      await refreshUser()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload that image')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setError('')
    setBusy(true)
    try {
      await deleteAvatar()
      await refreshUser()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove that image')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <h2 className="section-title">Profile picture</h2>
      <div className="mt-3 flex items-center gap-4">
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt=""
            className="h-16 w-16 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand text-xl font-semibold text-brand-ink">
            {initial}
          </span>
        )}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button onClick={() => fileInput.current?.click()} disabled={busy}>
              <IconCamera size={16} />
              {busy ? 'Working…' : user?.avatarUrl ? 'Change photo' : 'Upload photo'}
            </Button>
            {user?.avatarUrl && (
              <Button variant="danger" onClick={() => void remove()} disabled={busy}>
                <IconTrash size={16} />
                Remove
              </Button>
            )}
          </div>
          <span className="text-xs text-muted">JPEG, PNG, or WebP — up to 5 MB.</span>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={pick}
        />
      </div>
      {error && (
        <div className="mt-2">
          <Alert>{error}</Alert>
        </div>
      )}
    </Card>
  )
}

/**
 * A dismissible nudge, not a gate — an unverified email never blocks
 * anything in Fico (owner's call: soft-verify, visible to an admin, not
 * enforced). Dismissing it only hides it for this browser tab session;
 * it comes back next time until the email is actually verified.
 */
const EmailVerificationBanner = () => {
  const { user } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  if (!user || user.emailVerified || dismissed) return null

  const resend = async () => {
    setError('')
    setBusy(true)
    try {
      await resendVerificationEmail()
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-warning/40 bg-warning/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Your email isn't verified yet</p>
          <p className="mt-0.5 text-xs text-muted">
            {sent
              ? `Sent a new link to ${user.email} — check your inbox.`
              : "Doesn't block anything here, but confirming it's really you is a good idea."}
          </p>
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </div>
        <div className="flex shrink-0 items-start gap-1.5">
          {!sent && (
            <Button size="sm" variant="primary" onClick={() => void resend()} disabled={busy}>
              {busy ? 'Sending…' : 'Resend email'}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            iconOnly
            aria-label="Dismiss"
            title="Dismiss"
            onClick={() => setDismissed(true)}
          >
            <IconX size={15} />
          </Button>
        </div>
      </div>
    </Card>
  )
}

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
      {sessions === null && !error && <SkeletonRow />}
      {sessions && sessions.length === 0 && (
        <p className="mt-2 text-sm text-muted">Nothing to show.</p>
      )}
      {sessions && sessions.length > 0 && (
        <div className="table-wrap mt-2">
          <table className="table">
            <thead>
              <tr>
                <th>Device</th>
                <th>Last active</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.userAgent || 'Unknown device'}
                    {s.isCurrent && (
                      <span className="ml-2 chip">this device</span>
                    )}
                  </td>
                  <td className="text-muted">{formatDate(s.lastUsedAt)}</td>
                  <td className="text-right">
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => void revoke(s)}
                      disabled={busyId === s.id}
                    >
                      <IconLogOut size={14} />
                      {busyId === s.id ? 'Signing out…' : 'Sign out'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

/** Only ever shown to an admin — 2FA is enforced for that role specifically. */
const NEWLINE = String.fromCharCode(10)

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
  const [qr, setQr] = useState('')
  const [copied, setCopied] = useState(false)

  // A scannable QR code for the setup link — far easier than typing the key.
  useEffect(() => {
    if (!uri) return
    let cancelled = false
    void import('qrcode').then((QRCode) =>
      QRCode.toDataURL(uri, { margin: 1, width: 220 }).then((url) => {
        if (!cancelled) setQr(url)
      }),
    )
    return () => {
      cancelled = true
    }
  }, [uri])

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

  if (!user) return null

  return (
    <Card data-tour="account-2fa">
      <h2 className="section-title flex flex-wrap items-center gap-2">
        Two-step sign-in (2FA)
        <span className="rounded-md bg-panel-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
          Optional
        </span>
      </h2>
      <p className="mt-1 text-xs text-muted">
        An extra lock on your account: after your password, Fico also asks for a 6-digit code
        from an authenticator app on your phone. Totally optional — turn it on only if you’re
        comfortable using an authenticator app. Lost your phone and your backup codes? Ask the
        Fico admin to turn it off for you.
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
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>
              Install an authenticator app on your phone — Google Authenticator, Microsoft
              Authenticator or Authy all work (free).
            </li>
            <li>In the app, tap “+” / “Add account” and scan this QR code.</li>
            <li>Type the 6-digit code the app shows below, then tap Confirm.</li>
          </ol>
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-panel-2 p-3">
            {qr ? (
              <img
                src={qr}
                alt="QR code to add Fico to your authenticator app"
                width={180}
                height={180}
                className="rounded-md bg-white p-1"
              />
            ) : (
              <div className="h-[180px] w-[180px] animate-pulse rounded-md bg-panel" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">Can’t scan? Choose “Enter a setup key” in the app and type:</p>
              <p className="mt-1 break-all font-mono text-sm text-ink">{secret}</p>
            </div>
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
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => {
                void navigator.clipboard?.writeText(backupCodes.join(NEWLINE)).then(() => setCopied(true))
              }}
            >
              {copied ? 'Copied' : 'Copy codes'}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const blob = new Blob(
                  [
                    [
                      `Fico backup codes for ${user.username}`,
                      'Each code works once.',
                      '',
                      ...backupCodes,
                      '',
                    ].join(NEWLINE),
                  ],
                  { type: 'text/plain' },
                )
                const a = document.createElement('a')
                a.href = URL.createObjectURL(blob)
                a.download = 'fico-backup-codes.txt'
                a.click()
                URL.revokeObjectURL(a.href)
              }}
            >
              Download as a file
            </Button>
          </div>
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

/**
 * "Download and install like a normal app" — what that actually means for a
 * PWA: Chrome/Edge (desktop and Android) can install Fico as a real home-
 * screen / app-list icon that opens in its own window, offline-capable,
 * indistinguishable from a native app once installed — no app store, no
 * review, no cost. Safari never offers this automatically; there it's a
 * manual Share → Add to Home Screen, so this section shows instructions
 * instead of a button on iOS.
 */
const InstallAppSection = () => {
  const [platform, setPlatform] = useState<InstallPlatform>(installPlatform)
  const [busy, setBusy] = useState(false)
  const [declined, setDeclined] = useState(false)
  const [showOthers, setShowOthers] = useState(false)
  const kind = detectBrowser()
  const guide = installGuideFor(kind)
  const installed = isRunningInstalled()

  useEffect(
    () => onInstallAvailabilityChange(() => setPlatform(installPlatform())),
    [],
  )

  const install = async () => {
    setBusy(true)
    try {
      const accepted = await promptInstall()
      if (!accepted) setDeclined(true)
    } finally {
      setBusy(false)
      setPlatform(installPlatform())
    }
  }

  const others: BrowserKind[] = (
    ['desktop-chrome', 'desktop-edge', 'android-chrome', 'ios', 'android-samsung', 'mac-safari'] as BrowserKind[]
  ).filter((k) => k !== kind)

  return (
    <Card data-tour="account-install">
      <h2 className="section-title flex items-center gap-2">
        <IconDownload size={16} className="text-brand" />
        Install Fico as an app
      </h2>
      <p className="mt-1 text-xs text-muted">
        Puts Fico on your home screen or desktop like a normal app — its own icon, its own
        window, works offline. Free, nothing to download from a store.
      </p>

      {installed ? (
        <p className="mt-3 text-sm text-success">You’re using the installed app — you’re all set.</p>
      ) : (
        <>
          {platform === 'promptable' && (
            <div className="mt-3">
              <Button variant="primary" onClick={() => void install()} disabled={busy}>
                <IconDownload size={16} />
                {busy ? 'Opening…' : 'Install Fico'}
              </Button>
              <p className="mt-1 text-xs text-muted">One tap, then confirm “Install” in the little box that appears.</p>
              {declined && (
                <p className="mt-1 text-xs text-muted">No problem — you can install it any time from here.</p>
              )}
            </div>
          )}
          <div className="mt-3 rounded-xl border border-line bg-panel-2 p-3">
            <p className="text-xs font-semibold text-ink">
              {platform === 'promptable' ? 'Or do it yourself' : 'How to install'} — {guide.where}
            </p>
            <ol className={`mt-1.5 space-y-1 pl-5 text-sm ${guide.unsupported ? 'list-none pl-0 text-warning' : 'list-decimal'}`}>
              {guide.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => setShowOthers((v) => !v)}
        aria-expanded={showOthers}
        className="mt-3 flex items-center gap-1 text-xs font-medium text-muted hover:text-ink"
      >
        Using a different device?
        <IconChevronDown size={13} className={`transition-transform ${showOthers ? 'rotate-180' : ''}`} />
      </button>
      {showOthers && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {others.map((k) => {
            const g = installGuideFor(k)
            return (
              <div key={k} className="rounded-xl border border-line p-3">
                <p className="text-xs font-semibold text-ink">{g.where}</p>
                <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-xs text-muted">
                  {g.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

const Account = () => {
  const { user } = useAuth()

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title="Account"
        icon={IconUserCircle}
        description={user ? `Signed in as ${user.username}` : undefined}
      />
      <EmailVerificationBanner />
      <InstallAppSection />
      <AvatarSection />
      <PasswordSection />
      <DevicesSection />
      <TwoFactorSection />
    </div>
  )
}

export default Account
