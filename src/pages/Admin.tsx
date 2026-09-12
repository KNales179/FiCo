import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  listUserSessions,
  listUsers,
  revokeUserSession,
  setUserPassword,
  setUserRole,
  type AdminUser,
} from '../services/adminService'
import { Link } from 'react-router-dom'
import type { DeviceSession } from '../types/auth'
import { PageHeader, Card, Button, Input, Alert } from '../components/ui'

const formatDate = (iso: string) => new Date(iso).toLocaleString()

const ManagePanel = ({ user, onChanged }: { user: AdminUser; onChanged: () => void }) => {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [rolePassword, setRolePassword] = useState('')
  const [sessions, setSessions] = useState<DeviceSession[] | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const loadSessions = useCallback(async () => {
    try {
      const res = await listUserSessions(user.id)
      setSessions(res.sessions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load devices')
    }
  }, [user.id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSessions()
  }, [loadSessions])

  const submitPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    try {
      await setUserPassword(user.id, newPassword, confirmPassword)
      setNewPassword('')
      setConfirmPassword('')
      setNotice(`Password changed for ${user.username}. Every one of their devices was signed out.`)
      await loadSessions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password')
    } finally {
      setBusy(false)
    }
  }

  const toggleRole = async () => {
    const nextRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN'
    if (
      !window.confirm(
        nextRole === 'ADMIN'
          ? `Make ${user.username} an admin? They'll be able to manage every account.`
          : `Remove ${user.username}'s admin access?`,
      )
    )
      return
    if (!rolePassword) {
      setError('Enter your own password to confirm')
      return
    }
    setError('')
    setNotice('')
    setBusy(true)
    try {
      await setUserRole(user.id, nextRole, rolePassword)
      setRolePassword('')
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change role')
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (sessionId: string) => {
    if (!window.confirm(`Sign ${user.username} out of this device?`)) return
    setBusy(true)
    try {
      await revokeUserSession(user.id, sessionId)
      await loadSessions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign out that device')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 space-y-4 border-t border-line pt-3">
      {error && <Alert>{error}</Alert>}
      {notice && <p className="text-sm text-success">{notice}</p>}

      <div>
        <h3 className="text-sm font-medium">Set a new password</h3>
        <form onSubmit={submitPassword} className="mt-2 space-y-2">
          <Input
            type="password"
            placeholder="New password (min. 8 characters)"
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Your own current password, to confirm"
            autoComplete="current-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? 'Saving…' : 'Change password'}
          </Button>
        </form>
      </div>

      <div>
        <h3 className="text-sm font-medium">Admin role</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Input
            type="password"
            placeholder="Your own current password, to confirm"
            autoComplete="current-password"
            value={rolePassword}
            onChange={(e) => setRolePassword(e.target.value)}
            className="max-w-xs"
          />
          <Button size="sm" onClick={() => void toggleRole()} disabled={busy}>
            {user.role === 'ADMIN' ? 'Remove admin access' : 'Make admin'}
          </Button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium">Devices</h3>
        {sessions === null && <p className="mt-1 text-xs text-muted">Loading…</p>}
        {sessions && (
          <ul className="mt-1 divide-y divide-line text-sm">
            {sessions.length === 0 && (
              <li className="py-1.5 text-xs text-muted">No active devices.</li>
            )}
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 py-1.5">
                <span className="text-xs">
                  {s.userAgent || 'Unknown device'}
                  <span className="block text-muted">
                    last active {formatDate(s.lastUsedAt)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void revoke(s.id)}
                  disabled={busy}
                  className="text-xs text-muted underline hover:text-danger disabled:opacity-50"
                >
                  sign out
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

const Admin = () => {
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await listUsers()
      setUsers(res.users)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load users')
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title="Admin"
        description="Manage every account — not to be confused with a shared Finance's own owner."
      />

      <Link to="/admin/feedback" className="text-sm text-brand underline">
        Report & feedback →
      </Link>

      {error && <Alert>{error}</Alert>}
      {users === null && !error && <p className="text-sm text-muted">Loading…</p>}

      {users && (
        <Card>
          <ul className="divide-y divide-line">
            {users.map((u) => (
              <li key={u.id} className="py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span>
                    {u.displayName || u.username}
                    <span className="ml-2 text-xs text-muted">@{u.username}</span>
                    {u.role === 'ADMIN' && (
                      <span className="ml-2 rounded-full bg-brand/15 px-2 py-0.5 text-xs font-medium text-brand">
                        admin
                      </span>
                    )}
                    {u.totpEnabled && (
                      <span className="ml-2 text-xs text-success">2FA on</span>
                    )}
                    <span
                      className={`ml-2 text-xs ${u.emailVerified ? 'text-success' : 'text-warning'}`}
                    >
                      {u.emailVerified ? 'email verified' : 'email unverified'}
                    </span>
                    {u.status !== 'ACTIVE' && (
                      <span className="ml-2 text-xs text-danger">{u.status.toLowerCase()}</span>
                    )}
                    <span className="mt-0.5 block text-xs text-muted">
                      {u.email} · joined {formatDate(u.createdAt)}
                    </span>
                  </span>
                  {u.isSelf ? (
                    <span className="text-xs text-muted">
                      it's you — see{' '}
                      <a href="/account" className="underline">
                        Account
                      </a>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setOpenId(openId === u.id ? null : u.id)}
                      className="text-xs text-muted underline hover:text-ink"
                    >
                      {openId === u.id ? 'close' : 'manage'}
                    </button>
                  )}
                </div>
                {openId === u.id && !u.isSelf && (
                  <ManagePanel user={u} onChanged={() => void load()} />
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

export default Admin
