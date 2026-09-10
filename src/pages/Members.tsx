import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react'
import { useSpace } from '../hooks/useSpace'
import { useAuth } from '../hooks/useAuth'
import {
  inviteToSpace,
  listInvitations,
  listMembers,
  removeMember,
  revokeInvitation,
  updateMemberRole,
  type PendingInvitation,
} from '../services/spaceService'
import { isNetworkError } from '../lib/api'
import type { SpaceMember } from '../types/space'

const Members = () => {
  const { activeSpace } = useSpace()
  const { user } = useAuth()

  const [members, setMembers] = useState<SpaceMember[]>([])
  const [invites, setInvites] = useState<PendingInvitation[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'EDITOR' | 'VIEWER'>('VIEWER')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const isOwner = activeSpace?.role === 'OWNER'
  const isFamily = activeSpace?.type === 'FAMILY'
  const spaceId = activeSpace?.id

  const load = useCallback(async () => {
    if (!spaceId) return
    setLoading(true)
    setError('')
    try {
      const m = await listMembers(spaceId)
      setMembers(m.members)
      if (isOwner) {
        const inv = await listInvitations(spaceId)
        setInvites(inv.invitations)
      }
    } catch (err) {
      setError(
        isNetworkError(err)
          ? 'Members are unavailable offline'
          : err instanceof Error
            ? err.message
            : 'Could not load members',
      )
    } finally {
      setLoading(false)
    }
  }, [spaceId, isOwner])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const invite = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!spaceId) return
    setMessage('')
    setError('')
    try {
      const res = await inviteToSpace(spaceId, email, role)
      setMessage(res.message)
      setEmail('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not invite')
    }
  }

  if (!activeSpace) return null

  if (!isFamily) {
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
        <p className="mt-2 text-sm text-muted">
          {activeSpace.name} is a personal space — it's just you. Create a
          family space from the switcher to share with others.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{activeSpace.name} · members</h1>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {loading && <p className="text-sm text-muted">Loading…</p>}

      <section className="card">
        <ul className="divide-y">
          {members.map((m) => (
            <li
              key={m.userId}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span>
                {m.displayName || m.username || m.userId}
                {m.userId === user?.id && ' (you)'}
              </span>
              <span className="flex items-center gap-2">
                {isOwner && m.role !== 'OWNER' ? (
                  <select
                    value={m.role}
                    onChange={(e) =>
                      void updateMemberRole(
                        spaceId!,
                        m.userId,
                        e.target.value as 'EDITOR' | 'VIEWER',
                      ).then(load)
                    }
                    className="border px-1 py-0.5 text-xs"
                  >
                    <option value="EDITOR">editor</option>
                    <option value="VIEWER">viewer</option>
                  </select>
                ) : (
                  <span className="text-xs text-muted">
                    {m.role.toLowerCase()}
                  </span>
                )}
                {isOwner && m.role !== 'OWNER' && (
                  <button
                    type="button"
                    onClick={() =>
                      void removeMember(spaceId!, m.userId).then(load)
                    }
                    className="text-xs text-muted underline"
                  >
                    remove
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {isOwner && invites.length > 0 && (
        <section className="card">
          <h2 className="text-sm font-semibold">Pending invitations</h2>
          <ul className="mt-2 divide-y">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span>
                  {inv.email}{' '}
                  <span className="text-xs text-muted">
                    · {inv.role.toLowerCase()}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    void revokeInvitation(spaceId!, inv.id).then(load)
                  }
                  className="text-xs text-muted underline"
                >
                  revoke
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isOwner && (
        <form onSubmit={invite} className="card">
          <h2 className="text-sm font-semibold">Invite someone</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="their email"
              required
              className="min-w-[12rem] flex-1 border px-2 py-1 text-sm"
            />
            <select
              value={role}
              onChange={(e) =>
                setRole(e.target.value as 'EDITOR' | 'VIEWER')
              }
              className="border px-2 py-1 text-sm"
            >
              <option value="VIEWER">viewer</option>
              <option value="EDITOR">editor</option>
            </select>
            <button type="submit" className="border px-3 py-1 text-sm">
              Invite
            </button>
          </div>
          <p className="mt-1 text-xs text-muted">
            If they already use Fico they're added straight away; otherwise
            they join automatically when they sign up with that email.
          </p>
          {message && (
            <p className="mt-2 text-xs text-success">{message}</p>
          )}
        </form>
      )}
    </div>
  )
}

export default Members
