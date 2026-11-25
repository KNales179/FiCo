import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Badges from '../components/Badges'
import { ROLE_HINT, ROLE_LABEL } from '../features/spaces/roles'
import { Link, useNavigate } from 'react-router-dom'
import { useSpace } from '../hooks/useSpace'
import { useAuth } from '../hooks/useAuth'
import {
  inviteToSpace,
  leaveSpace,
  listInvitations,
  listMembers,
  removeMember,
  setMemberRole,
  revokeInvitation,
  transferOwnership,
  type PendingInvitation,
} from '../services/spaceService'
import { isNetworkError } from '../lib/api'
import { loadSnapshot, membersSnapshotKey, saveSnapshot } from '../features/offlineSnapshots'
import { isDemoMode } from '../features/demo/demoMode'
import { loadDemoMembers, setDemoMemberRole } from '../features/demo/members'
import type { SpaceMember } from '../types/space'
import { PageHeader, Card, Button, Input, Alert, EmptyState, SkeletonRow } from '../components/ui'
import {
  IconAward,
  IconLogOut,
  IconUserPlus,
  IconX,
  IconUsers,
  IconCloudOff,
} from '../components/icons'

const MemberAvatar = ({ member }: { member: SpaceMember }) => {
  const initial = (member.displayName || member.username || '?').charAt(0).toUpperCase()
  return member.avatarUrl ? (
    <img
      src={member.avatarUrl}
      alt=""
      className="h-8 w-8 shrink-0 rounded-full object-cover"
    />
  ) : (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-ink">
      {initial}
    </span>
  )
}

/** The member list as of the last time it loaded online — shown (read-only) offline. */
const cacheMembers = (spaceId: string, members: SpaceMember[]) =>
  saveSnapshot(membersSnapshotKey(spaceId), members)
const cachedMembers = (spaceId: string): SpaceMember[] =>
  loadSnapshot<SpaceMember[]>(membersSnapshotKey(spaceId))?.value ?? []

const Members = () => {
  const { activeSpace, refresh } = useSpace()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [members, setMembers] = useState<SpaceMember[]>([])
  const [invites, setInvites] = useState<PendingInvitation[]>([])
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  // Offline: show who was here last time, and hold the actions that need the server.
  const [offline, setOffline] = useState(false)

  const isOwner = activeSpace?.role === 'OWNER'
  // The owner and admins invite and remove people; only the owner sets roles.
  const canManage = isOwner || activeSpace?.role === 'ADMIN'
  const isFamily = activeSpace?.type === 'FAMILY'
  const spaceId = activeSpace?.id
  // The demo has a pretend household; only role changes work, on this device.
  const demo = isDemoMode()

  const load = useCallback(async () => {
    if (!spaceId) return
    setLoading(true)
    setError('')
    if (demo) {
      setMembers(loadDemoMembers())
      setLoading(false)
      return
    }
    try {
      const m = await listMembers(spaceId)
      setMembers(m.members)
      setOffline(false)
      cacheMembers(spaceId, m.members)
      if (canManage) {
        const inv = await listInvitations(spaceId)
        setInvites(inv.invitations)
      }
    } catch (err) {
      if (isNetworkError(err)) {
        setOffline(true)
        setMembers(cachedMembers(spaceId))
      } else {
        setError(err instanceof Error ? err.message : 'Could not load members')
      }
    } finally {
      setLoading(false)
    }
  }, [spaceId, canManage, demo])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const changeRole = async (m: SpaceMember, role: 'ADMIN' | 'MEMBER' | 'VIEWER') => {
    if (!spaceId) return
    setMessage('')
    setError('')
    if (demo) {
      setMembers(setDemoMemberRole(m.userId, role))
      setMessage(`${m.displayName || m.username} is now ${role === 'ADMIN' ? 'an' : 'a'} ${ROLE_LABEL[role]} — in the demo, they’d now get that role’s access.`)
      return
    }
    try {
      const res = await setMemberRole(spaceId, m.userId, role)
      setMessage(res.message)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change their role')
    }
  }

  const remove = async (m: SpaceMember) => {
    if (!spaceId) return
    const name = m.displayName || m.username || 'this member'
    if (!window.confirm(`Remove ${name} from ${activeSpace?.name}?`)) return
    setMessage('')
    setError('')
    try {
      await removeMember(spaceId, m.userId)
      setMessage(`${name} was removed`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove them')
    }
  }

  const invite = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!spaceId) return
    setMessage('')
    setError('')
    try {
      const res = await inviteToSpace(spaceId, email)
      setMessage(res.message)
      setEmail('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not invite')
    }
  }

  const makeOwner = async (member: SpaceMember) => {
    if (!spaceId) return
    const name = member.displayName || member.username || 'this member'
    if (
      !window.confirm(
        `Make ${name} the owner of ${activeSpace?.name}? You'll stay on as a member and lose owner-only controls.`,
      )
    )
      return
    try {
      await transferOwnership(spaceId, member.userId)
      await Promise.all([load(), refresh()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not transfer ownership')
    }
  }

  const leave = async () => {
    if (!spaceId) return
    if (!window.confirm(`Leave ${activeSpace?.name}? You'll lose access to it.`))
      return
    try {
      await leaveSpace(spaceId)
      await refresh()
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not leave')
    }
  }

  if (!activeSpace) return null

  if (!isFamily) {
    return (
      <div className="space-y-4">
        <PageHeader
          icon={IconUsers}
          title="Members"
          description={`${activeSpace.name} is a personal Finance — it's just you.`}
        />
        <p className="text-xs text-muted">
          {activeSpace.name}’s currency now lives in{' '}
          <Link to="/settings?tab=currency" className="font-medium text-brand underline">
            Settings → Currency
          </Link>
          .
        </p>
        <EmptyState title="Nothing to manage here">
          Create a shared Finance from the switcher to plan money with other
          people.
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
          icon={IconUsers}
        title={`${activeSpace.name} · members`}
        description="Owner sets roles · Owner and admins invite and remove people · Admins also edit everything and see Activity · Members add and edit · Viewers can only look."
        actions={
          !isOwner ? (
            <Button variant="ghost" onClick={() => void leave()} data-tour="members-leave">
              <IconLogOut size={16} />
              Leave Finance
            </Button>
          ) : undefined
        }
      />

      <p className="text-xs text-muted">
        {activeSpace.name}’s currency now lives in{' '}
        <Link to="/settings?tab=currency" className="font-medium text-brand underline">
          Settings → Currency
        </Link>
        .
      </p>

      {error && <Alert>{error}</Alert>}
      {offline && (
        <p className="flex items-start gap-2 rounded-xl border border-line bg-panel-2 px-3.5 py-2.5 text-sm text-muted">
          <IconCloudOff size={16} className="mt-0.5 shrink-0" />
          {members.length
            ? 'You’re offline — this is who was here the last time you checked. Inviting or removing people needs a connection.'
            : 'You’re offline — the member list loads once you’re back online.'}
        </p>
      )}

      {loading ? (
        <Card>
          <div className="divide-y divide-line">
            <SkeletonRow />
            <SkeletonRow />
          </div>
        </Card>
      ) : (
        <div className="table-wrap" data-tour="members-list">
          <table className="table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                {canManage && <th className="text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.userId}>
                  <td>
                    <span className="flex items-center gap-2.5">
                      <MemberAvatar member={m} />
                      <span className="min-w-0">
                        <span className="block">
                          {m.displayName || m.username || m.userId}
                          {m.userId === user?.id && (
                            <span className="text-muted"> (you)</span>
                          )}
                        </span>
                        <Badges badges={m.badges} size="xs" />
                      </span>
                    </span>
                  </td>
                  <td>
                    {isOwner && m.role !== 'OWNER' && !offline ? (
                      <select
                        value={m.role}
                        aria-label={`Role for ${m.displayName || m.username}`}
                        onChange={(e) => void changeRole(m, e.target.value as 'ADMIN' | 'MEMBER' | 'VIEWER')}
                        className="select w-auto py-1 text-sm"
                        title={ROLE_HINT[m.role]}
                      >
                        {(['ADMIN', 'MEMBER', 'VIEWER'] as const).map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={m.role === 'OWNER' ? 'chip' : 'text-sm text-muted'} title={ROLE_HINT[m.role]}>
                        {ROLE_LABEL[m.role]}
                      </span>
                    )}
                  </td>
                  {canManage && (
                    <td className="text-right">
                      {m.role !== 'OWNER' && m.userId !== user?.id && !offline && !demo && (
                        <span className="flex items-center justify-end gap-1">
                          {isOwner && (
                            <Button
                              size="sm"
                              iconOnly
                              aria-label="Make owner"
                              title="Make owner"
                              onClick={() => void makeOwner(m)}
                            >
                              <IconAward size={14} />
                            </Button>
                          )}
                          {/* Admins remove members and viewers; other admins are the owner's call. */}
                          {(isOwner || m.role !== 'ADMIN') && (
                            <Button
                              size="sm"
                              iconOnly
                              variant="danger"
                              aria-label={`Remove ${m.displayName || m.username}`}
                              title="Remove"
                              onClick={() => void remove(m)}
                            >
                              <IconX size={14} />
                            </Button>
                          )}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManage && invites.length > 0 && (
        <Card>
          <h2 className="section-title">Pending invitations</h2>
          <ul className="mt-2 divide-y divide-line">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span>{inv.email}</span>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => void revokeInvitation(spaceId!, inv.id).then(load)}
                >
                  <IconX size={14} />
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {canManage && (
        <Card data-tour="members-invite">
          <form onSubmit={invite}>
            <h2 className="section-title">Invite someone</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="their email"
                required
                className="min-w-[12rem] flex-1"
              />
              <Button
                type="submit"
                variant="primary"
                disabled={offline || demo}
                title={demo ? 'Create a free account to invite real people' : offline ? 'Needs a connection' : undefined}
              >
                <IconUserPlus size={16} />
                Invite
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted">
              If they already use Fico they're added straight away; otherwise
              they join automatically when they sign up with that email.
            </p>
            {demo && (
              <p className="mt-1 text-xs text-muted">
                These are pretend members — create a free account to invite real people. You can still try changing roles above.
              </p>
            )}
            {message && <p className="mt-2 text-xs text-success">{message}</p>}
          </form>
        </Card>
      )}
    </div>
  )
}

export default Members
