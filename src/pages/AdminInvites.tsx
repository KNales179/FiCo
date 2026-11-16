import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  createInviteCodes,
  listInviteCodes,
  revokeInviteCode,
  type InviteCode,
} from '../services/adminService'
import { Alert, Button, Card, EmptyState, Input, PageHeader, Select, SkeletonRow } from '../components/ui'
import { IconCopy, IconPlus, IconShare, IconTicket, IconX } from '../components/icons'

type Filter = 'UNUSED' | 'USED' | 'EXPIRED' | 'REVOKED' | 'ALL'

const signUpLink = (code: string) => `${window.location.origin}/register?code=${encodeURIComponent(code)}`

const shareText = (code: string) =>
  `You're invited to try Fico as a beta tester! Your one-time invite code: ${code} (it works for 1 hour)\nCreate your account here: ${signUpLink(code)}`

/** "expires in 42 min" — codes last an hour. */
const timeLeft = (expiresAt: string, now: number) => {
  const mins = Math.ceil((new Date(expiresAt).getTime() - now) / 60000)
  return mins <= 1 ? 'expires in under a minute' : `expires in ${mins} min`
}

/** The server's status, kept current while the page stays open. */
const statusOf = (c: InviteCode, now: number): InviteCode['status'] =>
  c.status === 'UNUSED' && c.expiresAt && new Date(c.expiresAt).getTime() <= now ? 'EXPIRED' : c.status

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

const STATUS_LOOK: Record<InviteCode['status'], { label: string; className: string }> = {
  UNUSED: { label: 'Unused', className: 'border-success/40 bg-success/10 text-success' },
  USED: { label: 'Used', className: 'border-line bg-panel-2 text-muted' },
  EXPIRED: { label: 'Expired', className: 'border-warning/40 bg-warning/10 text-warning' },
  REVOKED: { label: 'Cancelled', className: 'border-danger/30 bg-danger/10 text-danger' },
}

/**
 * Admin → Invite codes. Fico is invite-only for now: every new account
 * needs one of these one-time codes, and joining with one gives the
 * Beta tester badge.
 */
const AdminInvites = () => {
  const [codes, setCodes] = useState<InviteCode[] | null>(null)
  const [fresh, setFresh] = useState<InviteCode[]>([])
  const [count, setCount] = useState(1)
  const [note, setNote] = useState('')
  const [filter, setFilter] = useState<Filter>('UNUSED')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')
  // Ticks so "expires in …" counts down and codes flip to Expired on time.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const load = useCallback(async () => {
    try {
      const res = await listInviteCodes()
      setCodes(res.codes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load invite codes')
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setFlash(`${what} copied`)
    } catch {
      setFlash('Couldn’t copy — select it and copy by hand')
    }
    window.setTimeout(() => setFlash(''), 2500)
  }

  const make = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await createInviteCodes(count, note)
      setFresh(res.codes)
      setNote('')
      setFilter('UNUSED')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not make codes')
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (code: InviteCode) => {
    if (!window.confirm(`Cancel ${code.code}? Nobody will be able to sign up with it.`)) return
    setError('')
    try {
      const res = await revokeInviteCode(code.id)
      setFlash(res.message)
      setFresh((list) => list.filter((c) => c.id !== code.id))
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel that code')
    }
  }

  const counts = useMemo(() => {
    const c = { UNUSED: 0, USED: 0, EXPIRED: 0, REVOKED: 0, ALL: codes?.length ?? 0 }
    for (const code of codes ?? []) c[statusOf(code, now)] += 1
    return c
  }, [codes, now])
  const shown = (codes ?? []).filter((c) => filter === 'ALL' || statusOf(c, now) === filter)
  const freshLive = fresh.filter((c) => statusOf(c, now) === 'UNUSED')

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title="Invite codes"
        icon={IconTicket}
        description="Fico is invite-only for now. Each code creates one account and works for 1 hour; whoever uses it gets the Beta tester badge."
      />

      {error && <Alert>{error}</Alert>}
      {flash && (
        <p role="status" className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
          {flash}
        </p>
      )}

      <Card>
        <form onSubmit={make} className="space-y-3">
          <h2 className="section-title">Make beta tester codes</h2>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block w-24">
              <span className="field-label">How many</span>
              <Select value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="How many codes">
                {[1, 2, 3, 5, 10, 20].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block min-w-[12rem] flex-1">
              <span className="field-label">Who’s it for? (optional, only admins see this)</span>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={80}
                placeholder="e.g. Ate Liza, or Facebook giveaway"
              />
            </label>
            <Button type="submit" variant="primary" disabled={busy}>
              <IconPlus size={16} />
              {busy ? 'Making…' : count === 1 ? 'Make code' : `Make ${count} codes`}
            </Button>
          </div>
        </form>

        {freshLive.length > 0 && (
          <div className="mt-4 space-y-2 rounded-xl border border-brand/40 bg-brand/5 p-3">
            <p className="text-sm font-medium text-ink">
              {freshLive.length === 1 ? 'Your new code' : `Your ${freshLive.length} new codes`} — send each one to one person:
            </p>
            <ul className="space-y-2">
              {freshLive.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2">
                  <code className="rounded-md bg-panel px-2 py-1 font-mono text-base font-semibold tracking-wider text-ink">
                    {c.code}
                  </code>
                  <Button size="sm" onClick={() => void copy(c.code, 'Code')}>
                    <IconCopy size={14} /> Copy code
                  </Button>
                  <Button size="sm" onClick={() => void copy(shareText(c.code), 'Invite message')}>
                    <IconShare size={14} /> Copy invite message
                  </Button>
                  {c.expiresAt && <span className="text-xs text-muted">{timeLeft(c.expiresAt, now)}</span>}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted">
              Codes work for 1 hour, so send them right away. The invite message includes a sign-up link with the
              code already filled in.
            </p>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="section-title">All codes</h2>
          <div className="inline-flex rounded-xl border border-line bg-panel p-1 text-sm" role="tablist" aria-label="Show codes">
            {(
              [
                ['UNUSED', 'Unused'],
                ['USED', 'Used'],
                ['EXPIRED', 'Expired'],
                ['REVOKED', 'Cancelled'],
                ['ALL', 'All'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                onClick={() => setFilter(key)}
                className={[
                  'rounded-lg px-2.5 py-1 font-medium transition-colors',
                  filter === key ? 'bg-brand text-brand-ink' : 'text-muted hover:text-ink',
                ].join(' ')}
              >
                {label} · {counts[key]}
              </button>
            ))}
          </div>
        </div>

        {codes === null && !error ? (
          <div className="mt-2">
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : shown.length === 0 ? (
          <div className="mt-3">
            <EmptyState title={filter === 'UNUSED' ? 'No unused codes' : 'Nothing here'}>
              {filter === 'UNUSED' ? 'Make a code above when someone wants to try Fico.' : 'Codes will show up here.'}
            </EmptyState>
          </div>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {shown.map((c) => {
              const status = statusOf(c, now)
              const look = STATUS_LOOK[status]
              return (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <code className="font-mono text-sm font-semibold tracking-wider text-ink">{c.code}</code>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${look.className}`}>
                        {look.label}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {c.note && <span className="text-ink">{c.note} · </span>}
                      made {fmt(c.createdAt)}
                      {c.createdBy && ` by @${c.createdBy.username}`}
                      {status === 'UNUSED' && c.expiresAt && ` · ${timeLeft(c.expiresAt, now)}`}
                      {status === 'EXPIRED' && ' · expired unused'}
                      {status === 'USED' && c.usedBy && (
                        <>
                          {' · used by '}
                          <Link to={`/admin/users/${c.usedBy.id}`} className="text-brand underline">
                            @{c.usedBy.username}
                          </Link>
                          {c.usedAt && ` on ${fmt(c.usedAt)}`}
                        </>
                      )}
                      {status === 'REVOKED' && c.revokedAt && ` · cancelled ${fmt(c.revokedAt)}`}
                    </span>
                  </span>
                  {status === 'UNUSED' && (
                    <span className="flex items-center gap-1">
                      <Button size="sm" iconOnly aria-label={`Copy ${c.code}`} title="Copy code" onClick={() => void copy(c.code, 'Code')}>
                        <IconCopy size={14} />
                      </Button>
                      <Button
                        size="sm"
                        iconOnly
                        aria-label={`Copy invite message for ${c.code}`}
                        title="Copy invite message (with sign-up link)"
                        onClick={() => void copy(shareText(c.code), 'Invite message')}
                      >
                        <IconShare size={14} />
                      </Button>
                      <Button
                        size="sm"
                        iconOnly
                        variant="danger"
                        aria-label={`Cancel ${c.code}`}
                        title="Cancel this code"
                        onClick={() => void cancel(c)}
                      >
                        <IconX size={14} />
                      </Button>
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}

export default AdminInvites
