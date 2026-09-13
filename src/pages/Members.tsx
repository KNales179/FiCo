import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSpace } from '../hooks/useSpace'
import { useAuth } from '../hooks/useAuth'
import {
  inviteToSpace,
  leaveSpace,
  listInvitations,
  listMembers,
  removeMember,
  revokeInvitation,
  transferOwnership,
  updateSpaceCurrency,
  type PendingInvitation,
} from '../services/spaceService'
import { isNetworkError } from '../lib/api'
import { SUPPORTED_CURRENCIES } from '../domain/money'
import type { SpaceMember, SpaceSummary } from '../types/space'
import { PageHeader, Card, Button, Input, Alert, EmptyState, SkeletonRow } from '../components/ui'
import { IconAward, IconLogOut, IconUserPlus, IconX } from '../components/icons'

/**
 * The Finance's currency — every account created in it defaults to this,
 * and it's what a cross-currency transfer converts into. Anyone can see it;
 * only the owner can change it (a personal space's owner is always its
 * only member, so this reads as "freely settable" there and as a real
 * restriction only once other people share the space).
 */
const CurrencyCard = ({
  space,
  isOwner,
  onChanged,
}: {
  space: SpaceSummary
  isOwner: boolean
  onChanged: () => Promise<void>
}) => {
  const [currency, setCurrency] = useState(space.currency)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrency(space.currency)
  }, [space.currency])

  const save = async () => {
    setError('')
    setMessage('')
    setBusy(true)
    try {
      await updateSpaceCurrency(space.id, currency)
      await onChanged()
      setMessage('Currency updated')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not change the currency',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <h2 className="section-title">Finance currency</h2>
      <p className="mt-1 text-xs text-muted">
        New accounts in {space.name} default to this currency. Accounts can
        still use a different one — Fico converts at today's rate when
        money transfers between them.
        {!isOwner && ' Only the owner can change it.'}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          disabled={!isOwner}
          className="select w-auto"
        >
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {isOwner && currency !== space.currency && (
          <Button size="sm" variant="primary" disabled={busy} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        )}
      </div>
      {message && <p className="mt-2 text-xs text-success">{message}</p>}
      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}
    </Card>
  )
}

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
          title="Members"
          description={`${activeSpace.name} is a personal Finance — it's just you.`}
        />
        <CurrencyCard space={activeSpace} isOwner={isOwner} onChanged={refresh} />
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
        title={`${activeSpace.name} · members`}
        description="Everyone here is a full participant. Only the owner can invite, remove, or hand over the Finance."
        actions={
          !isOwner ? (
            <Button variant="ghost" onClick={() => void leave()}>
              <IconLogOut size={16} />
              Leave Finance
            </Button>
          ) : undefined
        }
      />

      <CurrencyCard space={activeSpace} isOwner={isOwner} onChanged={refresh} />

      {error && <Alert>{error}</Alert>}

      {loading ? (
        <Card>
          <div className="divide-y divide-line">
            <SkeletonRow />
            <SkeletonRow />
          </div>
        </Card>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                {isOwner && <th className="text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.userId}>
                  <td>
                    <span className="flex items-center gap-2.5">
                      <MemberAvatar member={m} />
                      <span>
                        {m.displayName || m.username || m.userId}
                        {m.userId === user?.id && (
                          <span className="text-muted"> (you)</span>
                        )}
                      </span>
                    </span>
                  </td>
                  <td>
                    {m.role === 'OWNER' ? (
                      <span className="chip">owner</span>
                    ) : (
                      <span className="text-muted">member</span>
                    )}
                  </td>
                  {isOwner && (
                    <td className="text-right">
                      {m.role !== 'OWNER' && (
                        <span className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            iconOnly
                            aria-label="Make owner"
                            title="Make owner"
                            onClick={() => void makeOwner(m)}
                          >
                            <IconAward size={14} />
                          </Button>
                          <Button
                            size="sm"
                            iconOnly
                            variant="danger"
                            aria-label="Remove"
                            title="Remove"
                            onClick={() => void removeMember(spaceId!, m.userId).then(load)}
                          >
                            <IconX size={14} />
                          </Button>
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

      {isOwner && invites.length > 0 && (
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

      {isOwner && (
        <Card>
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
              <Button type="submit" variant="primary">
                <IconUserPlus size={16} />
                Invite
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted">
              If they already use Fico they're added straight away; otherwise
              they join automatically when they sign up with that email.
            </p>
            {message && <p className="mt-2 text-xs text-success">{message}</p>}
          </form>
        </Card>
      )}
    </div>
  )
}

export default Members
