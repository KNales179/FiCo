import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  deleteUser,
  getUserProfile,
  resetUserTwoFactor,
  restrictUser,
  revokeUserSession,
  sendUserNotice,
  setUserBadge,
  setUserPassword,
  setUserRole,
  signOutUserEverywhere,
  unrestrictUser,
  type AdminAuditEntry,
  type AdminUserProfile,
} from '../services/adminService'
import type { DeviceSession } from '../types/auth'
import { useAuth } from '../hooks/useAuth'
import { Alert, Button, Card, Modal, SkeletonCard, Switch } from '../components/ui'
import PasswordInput from '../components/auth/PasswordInput'
import Badges from '../components/Badges'
import RoleTags from '../components/RoleTags'
import ReasonTemplates from '../components/admin/ReasonTemplates'
import type { TemplateKind } from '../features/admin/reasonTemplates'
import { describeUntil } from '../features/auth/authNotice'
import {
  IconCheck,
  IconChevronLeft,
  IconClock,
  IconLock,
  IconLogOut,
  IconMessage,
  IconRotateCcw,
  IconShield,
  IconTrash,
  IconX,
} from '../components/icons'

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'

const DURATIONS: { label: string; hours: number | null }[] = [
  { label: '1 hour', hours: 1 },
  { label: '1 day', hours: 24 },
  { label: '3 days', hours: 72 },
  { label: '7 days', hours: 168 },
  { label: '30 days', hours: 720 },
  { label: 'Until I lift it', hours: null },
]

const ACTION_LABEL: Record<string, string> = {
  SET_PASSWORD: 'Set a new password',
  SET_ROLE: 'Changed role',
  REVOKE_SESSION: 'Signed out a device',
  RESET_2FA: 'Turned off 2FA',
  SEND_NOTICE: 'Sent a notice',
  SIGN_OUT_ALL: 'Signed out everywhere',
  RESTRICT: 'Restricted',
  UNRESTRICT: 'Lifted restriction',
  DELETE_USER: 'Deleted account',
  STEP_UP_FAILED: 'Wrong admin password',
  SET_BADGE: 'Changed a badge',
  APPEAL_DECISION: 'Decided an appeal',
}

type ActionKey = 'notice' | 'signout' | 'restrict' | 'password' | 'role' | 'twofa' | 'delete' | null

/** "This is what they'll see" — so the admin writes the reason for the person reading it. */
const Preview = ({ children }: { children: ReactNode }) => (
  <div className="rounded-xl border border-dashed border-line bg-panel-2 px-3 py-2.5 text-xs text-muted">
    <p className="mb-1 font-semibold uppercase tracking-wider">What they'll see</p>
    <div className="text-sm text-ink">{children}</div>
  </div>
)

const ActionTile = ({
  icon: Icon,
  title,
  body,
  onClick,
  danger,
  disabled,
}: {
  icon: typeof IconMessage
  title: string
  body: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
      danger ? 'border-danger/30 hover:bg-danger/5' : 'border-line hover:border-brand/50 hover:bg-brand/5'
    }`}
  >
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
        danger ? 'bg-danger/12 text-danger' : 'bg-brand/12 text-brand'
      }`}
    >
      <Icon size={17} />
    </span>
    <span className="min-w-0">
      <span className={`block text-sm font-semibold ${danger ? 'text-danger' : 'text-ink'}`}>{title}</span>
      <span className="block text-xs text-muted">{body}</span>
    </span>
  </button>
)

/**
 * An admin's view of one account: who they are, how they use Fico, and
 * everything an admin can do about it — message them, sign them out,
 * restrict or delete the account — each with a reason the person is shown.
 */
const AdminUser = () => {
  const { userId = '' } = useParams()
  const navigate = useNavigate()
  const { user: me, refreshUser } = useAuth()

  const [profile, setProfile] = useState<AdminUserProfile | null>(null)
  const [sessions, setSessions] = useState<DeviceSession[]>([])
  const [audit, setAudit] = useState<AdminAuditEntry[]>([])
  const [loadError, setLoadError] = useState('')
  const [flash, setFlash] = useState('')

  const [action, setAction] = useState<ActionKey>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // One set of form fields shared by whichever action dialog is open.
  const [reason, setReason] = useState('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [anonymous, setAnonymous] = useState(true)
  const [hours, setHours] = useState<number | null>(24)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [typedName, setTypedName] = useState('')

  const load = useCallback(async () => {
    setLoadError('')
    try {
      const res = await getUserProfile(userId)
      setProfile(res.user)
      setSessions(res.sessions)
      setAudit(res.audit)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load that user')
    }
  }, [userId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const openAction = (key: ActionKey) => {
    setReason('')
    setTitle('')
    setMessage('')
    setAnonymous(true)
    setHours(24)
    setNewPassword('')
    setConfirmPassword('')
    setTypedName('')
    setError('')
    setAction(key)
  }

  const run = async (fn: () => Promise<{ message: string }>, after?: () => void) => {
    setBusy(true)
    setError('')
    try {
      const res = await fn()
      setFlash(res.message)
      setAction(null)
      after?.()
      await load()
      // Changed your own account (a badge, say): your profile should show it now.
      if (profile?.isSelf) await refreshUser().catch(() => undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That didn’t work')
    } finally {
      setBusy(false)
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <IconChevronLeft size={16} /> All users
        </Link>
        <Alert>{loadError}</Alert>
      </div>
    )
  }
  if (!profile) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={5} />
      </div>
    )
  }

  const name = profile.displayName || profile.username
  const deleted = profile.status !== 'ACTIVE'
  const myName = me?.displayName || me?.username || 'you'
  const canEnd = !profile.isSelf && !deleted

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (action === 'notice') {
      void run(() => sendUserNotice(profile.id, { title: title.trim() || undefined, message: message.trim(), anonymous }))
    } else if (action === 'signout') {
      void run(() => signOutUserEverywhere(profile.id, reason.trim()))
    } else if (action === 'restrict') {
      void run(() => restrictUser(profile.id, reason.trim(), hours, confirmPassword))
    } else if (action === 'password') {
      void run(() => setUserPassword(profile.id, newPassword, confirmPassword, reason.trim()))
    } else if (action === 'role') {
      void run(() => setUserRole(profile.id, profile.role === 'ADMIN' ? 'USER' : 'ADMIN', confirmPassword, reason.trim()))
    } else if (action === 'twofa') {
      void run(() => resetUserTwoFactor(profile.id, confirmPassword, reason.trim()))
    } else if (action === 'delete') {
      void run(() => deleteUser(profile.id, reason.trim(), confirmPassword))
    }
  }

  const confirmField = (
    <label className="block">
      <span className="field-label">Your own password, to confirm</span>
      <PasswordInput
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        autoComplete="current-password"
        required
      />
    </label>
  )

  const reasonField = (required: boolean, placeholder: string, kind: TemplateKind) => (
    <div className="space-y-2">
    <ReasonTemplates kind={kind} value={reason} onPick={setReason} />
    <label className="block">
      <span className="field-label">Reason {required ? '' : '(optional)'}</span>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        maxLength={500}
        minLength={required ? 3 : undefined}
        required={required}
        placeholder={placeholder}
        className="input resize-y"
      />
      <span className="mt-1 block text-xs text-muted">They'll read this — write it for them.</span>
    </label>
    </div>
  )

  const durationLabel = DURATIONS.find((d) => d.hours === hours)?.label ?? ''

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <IconChevronLeft size={16} /> All users
      </Link>

      {/* Who they are */}
      <section className="hero-card">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" className="h-20 w-20 rounded-full object-cover ring-4 ring-brand/20" />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand text-2xl font-bold text-brand-ink ring-4 ring-brand/20">
              {name.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-extrabold tracking-tight text-ink">{name}</h1>
            <p className="truncate text-sm text-muted">
              @{profile.username} · {profile.email}
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5 text-xs font-medium sm:justify-start">
              {profile.isSelf && <span className="rounded-full bg-panel-2 px-2.5 py-1 text-muted">This is you</span>}
              {profile.role === 'ADMIN' && <span className="rounded-full bg-brand/15 px-2.5 py-1 text-brand">Admin</span>}
              <span
                className={`rounded-full px-2.5 py-1 ${profile.emailVerified ? 'bg-success/12 text-success' : 'bg-warning/15 text-warning'}`}
              >
                {profile.emailVerified ? 'Email verified' : 'Email unverified'}
              </span>
              {profile.totpEnabled && <span className="rounded-full bg-success/12 px-2.5 py-1 text-success">2FA on</span>}
              {profile.restriction && (
                <span className="rounded-full bg-warning/15 px-2.5 py-1 text-warning">Restricted</span>
              )}
              {deleted && <span className="rounded-full bg-danger/12 px-2.5 py-1 text-danger">Deleted</span>}
            </div>
            {profile.badges.length > 0 && (
              <div className="mt-2 flex justify-center sm:justify-start">
                <Badges badges={profile.badges} />
              </div>
            )}
            {profile.financeRoles.length > 0 && (
              <div className="mt-2">
                <RoleTags finances={profile.financeRoles} align="center" />
              </div>
            )}
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Joined', fmt(profile.createdAt)],
            ['Last active', fmt(profile.lastActiveAt)],
            ['Finances', `${profile.stats.finances} (owns ${profile.stats.ownedFinances})`],
            ['Reports sent', `${profile.stats.feedbackTotal}${profile.stats.feedbackOpen ? ` · ${profile.stats.feedbackOpen} open` : ''}`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-panel/60 px-3 py-2">
              <dt className="text-[11px] uppercase tracking-wider text-muted">{label}</dt>
              <dd className="text-sm font-semibold text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {flash && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          <span className="flex items-center gap-2">
            <IconCheck size={16} /> {flash}
          </span>
          <button type="button" onClick={() => setFlash('')} aria-label="Dismiss">
            <IconX size={15} />
          </button>
        </div>
      )}

      {profile.restriction && (
        <Card className="border-warning/40 bg-warning/5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-warning">
                <IconClock size={16} /> Restricted {describeUntil(profile.restriction.until)}
              </p>
              <p className="mt-1 text-sm text-ink">“{profile.restriction.reason}”</p>
              <p className="mt-1 text-xs text-muted">Since {fmt(profile.restriction.at)}</p>
            </div>
            <Button size="sm" variant="primary" disabled={busy} onClick={() => void run(() => unrestrictUser(profile.id))}>
              <IconRotateCcw size={14} /> Lift restriction
            </Button>
          </div>
        </Card>
      )}

      {profile.deletedByAdmin && (
        <Alert>
          Deleted by an admin on {fmt(profile.deletedByAdmin.at)} — “{profile.deletedByAdmin.reason}”
        </Alert>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <Card>
            <h2 className="section-title">What you can do</h2>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              <ActionTile
                icon={IconMessage}
                title="Send a notice"
                body="A message that pops up for them — from you, or from the Admin Team."
                onClick={() => openAction('notice')}
                disabled={deleted}
              />
              <ActionTile
                icon={IconLogOut}
                title="Sign out everywhere"
                body={`${sessions.length} device${sessions.length === 1 ? '' : 's'} signed in. They can sign straight back in.`}
                onClick={() => openAction('signout')}
                disabled={!canEnd}
              />
              <ActionTile
                icon={IconLock}
                title="Set a new password"
                body="Signs every device out; tell them the new one."
                onClick={() => openAction('password')}
                disabled={!canEnd}
              />
              <ActionTile
                icon={IconShield}
                title={profile.role === 'ADMIN' ? 'Remove admin access' : 'Make admin'}
                body={profile.role === 'ADMIN' ? 'Back to a regular account.' : 'They’ll be able to manage every account.'}
                onClick={() => openAction('role')}
                disabled={profile.isSelf || deleted || profile.badges.includes('FICO_OWNER')}
              />
              {profile.totpEnabled && (
                <ActionTile
                  icon={IconRotateCcw}
                  title="Turn off 2FA"
                  body="Only if they lost their phone and backup codes."
                  onClick={() => openAction('twofa')}
                  disabled={!canEnd}
                />
              )}
            </div>

            <h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-danger">Danger zone</h3>
            <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
              <ActionTile
                icon={IconClock}
                title={profile.restriction ? 'Change restriction' : 'Restrict (block) account'}
                body="Blocks sign-in for a while, with a reason they’re shown."
                onClick={() => openAction('restrict')}
                danger
                disabled={!canEnd || profile.role === 'ADMIN'}
              />
              <ActionTile
                icon={IconTrash}
                title="Delete account"
                body="Closes their account and the Finances they own."
                onClick={() => openAction('delete')}
                danger
                disabled={!canEnd || profile.role === 'ADMIN'}
              />
            </div>
            {profile.role === 'ADMIN' && !profile.isSelf && (
              <p className="mt-2 text-xs text-muted">To restrict or delete an admin, remove their admin access first.</p>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <h2 className="section-title">Badges</h2>
            <p className="mt-1 text-xs text-muted">Shown on their profile.</p>
            <ul className="mt-3 space-y-2">
              <li className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">Fico Admin</span>
                  <span className="block text-xs text-muted">
                    Comes with admin access — it asks for your password and a reason.
                  </span>
                </span>
                <Switch
                  checked={profile.role === 'ADMIN'}
                  label="Fico Admin"
                  disabled={busy || deleted || profile.isSelf || profile.badges.includes('FICO_OWNER')}
                  onChange={() => openAction('role')}
                />
              </li>
              {(
                [
                  ['FICO_OWNER', 'Fico Owner', 'There’s only one — it can’t be given to anyone else.'],
                  ['BETA_TESTER', 'Beta tester', 'For people helping test Fico.'],
                ] as const
              ).map(([badge, label, hint]) => {
                const has = profile.badges.includes(badge)
                return (
                  <li key={badge} className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink">{label}</span>
                      <span className="block text-xs text-muted">{hint}</span>
                    </span>
                    <Switch
                      checked={has}
                      label={label}
                      // Fico Owner: only ever on your own account (the server checks the rest).
                      disabled={busy || deleted || (badge === 'FICO_OWNER' && !profile.isSelf)}
                      onChange={(on) => void run(() => setUserBadge(profile.id, badge, on))}
                    />
                  </li>
                )
              })}
            </ul>
          </Card>

          <Card>
            <h2 className="section-title">Signed-in devices</h2>
            <ul className="mt-2 divide-y divide-line text-sm">
              {sessions.length === 0 && <li className="py-2 text-xs text-muted">No signed-in devices.</li>}
              {sessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0 text-xs">
                    <span className="block truncate text-ink">{s.userAgent || 'Unknown device'}</span>
                    <span className="text-muted">last active {fmt(s.lastUsedAt)}</span>
                  </span>
                  {canEnd && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void run(() => revokeUserSession(profile.id, s.id))}
                      aria-label="Sign out this device"
                      title="Sign out this device"
                    >
                      <IconLogOut size={14} />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h2 className="section-title">Admin history</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {audit.length === 0 && <li className="text-xs text-muted">Nothing yet.</li>}
              {audit.map((a) => (
                <li key={a.id} className="rounded-lg bg-panel-2 px-3 py-2">
                  <p className={`text-xs font-semibold ${a.result === 'FAILURE' ? 'text-danger' : 'text-ink'}`}>
                    {ACTION_LABEL[a.action] ?? a.action} <span className="font-normal text-muted">· by {a.actor}</span>
                  </p>
                  {a.detail && <p className="mt-0.5 text-xs text-muted">{a.detail}</p>}
                  <p className="mt-0.5 text-[11px] text-muted">{fmt(a.createdAt)}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {action && (
        <Modal
          title={
            {
              notice: `Send ${name} a notice`,
              signout: `Sign ${name} out everywhere`,
              restrict: `Restrict ${name}`,
              password: `Set a new password for ${name}`,
              role: profile.role === 'ADMIN' ? `Remove ${name}'s admin access` : `Make ${name} an admin`,
              twofa: `Turn off ${name}'s 2FA`,
              delete: `Delete ${name}'s account`,
            }[action]
          }
          onClose={() => !busy && setAction(null)}
        >
          <form onSubmit={submit} className="mt-3 space-y-3">
            {action === 'notice' && (
              <>
                <label className="block">
                  <span className="field-label">Title (optional)</span>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className="input" placeholder="e.g. Quick heads-up" />
                </label>
                <ReasonTemplates kind="notice" value={message} onPick={setMessage} />
                <label className="block">
                  <span className="field-label">Message</span>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    maxLength={2000}
                    required
                    className="input resize-y"
                    placeholder="Anything you'd like them to know"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Send as">
                  {[
                    [true, 'Fico Admin Team', 'Anonymous'],
                    [false, myName, 'Signed by you'],
                  ].map(([value, label, hint]) => (
                    <button
                      key={String(value)}
                      type="button"
                      role="radio"
                      aria-checked={anonymous === value}
                      onClick={() => setAnonymous(value as boolean)}
                      className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                        anonymous === value ? 'border-brand bg-brand/10' : 'border-line hover:bg-panel-2'
                      }`}
                    >
                      <span className="block text-sm font-semibold text-ink">{label as string}</span>
                      <span className="block text-xs text-muted">{hint as string}</span>
                    </button>
                  ))}
                </div>
                <Preview>
                  <p className="font-semibold">
                    {title.trim() || (anonymous ? 'A message from the Fico Admin Team' : `A message from ${myName}`)}
                  </p>
                  <p className="mt-0.5 whitespace-pre-line text-muted">{message.trim() || '…'}</p>
                  <p className="mt-1 text-xs text-muted">— {anonymous ? 'Fico Admin Team' : myName}</p>
                </Preview>
              </>
            )}

            {action === 'signout' && (
              <>
                {reasonField(false, 'e.g. Signing out a lost phone — please sign in again', 'signout')}
                <Preview>
                  <p className="font-semibold">You have been signed out by the Fico Admin Team</p>
                  {reason.trim() && <p className="mt-0.5 text-muted">Reason: {reason.trim()}</p>}
                </Preview>
              </>
            )}

            {action === 'restrict' && (
              <>
                {reasonField(true, 'e.g. Repeated spam in shared Finances', 'restrict')}
                <div>
                  <span className="field-label">For how long</span>
                  <div className="flex flex-wrap gap-2">
                    {DURATIONS.map((d) => (
                      <button
                        key={d.label}
                        type="button"
                        onClick={() => setHours(d.hours)}
                        className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                          hours === d.hours ? 'border-brand bg-brand text-brand-ink' : 'border-line text-muted hover:text-ink'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Preview>
                  <p className="font-semibold">Your account is restricted on Fico</p>
                  {reason.trim() && <p className="mt-0.5 text-muted">Reason: {reason.trim()}</p>}
                  <p className="mt-0.5 text-muted">
                    You can't sign in {hours === null ? 'until the Fico Admin Team lifts it' : `for ${durationLabel}`}.
                  </p>
                </Preview>
                <p className="text-xs text-muted">Every device of theirs is signed out right away.</p>
                {confirmField}
              </>
            )}

            {action === 'password' && (
              <>
                <label className="block">
                  <span className="field-label">New password</span>
                  <PasswordInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required autoComplete="new-password" />
                </label>
                {reasonField(false, 'e.g. You asked for a reset — here it is', 'password')}
                {confirmField}
              </>
            )}

            {action === 'role' && (
              <>
                {reasonField(false, profile.role === 'ADMIN' ? 'e.g. Thanks for helping out!' : 'e.g. Welcome to the team', 'role')}
                <Preview>
                  <p className="font-semibold">
                    {profile.role === 'ADMIN' ? 'Your admin access was removed' : 'You’re now a Fico admin'}
                  </p>
                  {reason.trim() && <p className="mt-0.5 text-muted">{reason.trim()}</p>}
                </Preview>
                {confirmField}
              </>
            )}

            {action === 'twofa' && (
              <>
                {reasonField(false, 'e.g. You lost your phone — set it up again when you can', 'twofa')}
                {confirmField}
              </>
            )}

            {action === 'delete' && (
              <>
                <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
                  Their account is closed, they're removed from every shared Finance, and the Finances they own are closed
                  too. This can't be undone from the app.
                </p>
                {reasonField(true, 'e.g. Requested by the account owner', 'delete')}
                <label className="block">
                  <span className="field-label">
                    Type <span className="font-mono text-ink">{profile.username}</span> to confirm
                  </span>
                  <input value={typedName} onChange={(e) => setTypedName(e.target.value)} className="input" autoCapitalize="none" spellCheck={false} />
                </label>
                <Preview>
                  <p className="font-semibold">Your Fico account has been deleted by the Fico Admin Team</p>
                  {reason.trim() && <p className="mt-0.5 text-muted">Reason: {reason.trim()}</p>}
                </Preview>
                {confirmField}
              </>
            )}

            {error && <Alert>{error}</Alert>}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" onClick={() => setAction(null)} disabled={busy}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant={action === 'delete' || action === 'restrict' ? 'danger' : 'primary'}
                disabled={busy || (action === 'delete' && typedName !== profile.username)}
              >
                {busy
                  ? 'Working…'
                  : {
                      notice: 'Send notice',
                      signout: 'Sign them out',
                      restrict: 'Restrict account',
                      password: 'Set password',
                      role: profile.role === 'ADMIN' ? 'Remove admin' : 'Make admin',
                      twofa: 'Turn off 2FA',
                      delete: 'Delete account',
                    }[action]}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {deleted && (
        <Button onClick={() => navigate('/admin')}>
          <IconChevronLeft size={15} /> Back to all users
        </Button>
      )}
    </div>
  )
}

export default AdminUser
