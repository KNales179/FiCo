import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { decideAppeal, getAppeal, type AdminAppealDetail } from '../services/appealService'
import { Alert, Button, Card, SkeletonCard } from '../components/ui'
import ReasonTemplates from '../components/admin/ReasonTemplates'
import type { TemplateKind } from '../features/admin/reasonTemplates'
import { describeUntil } from '../features/auth/authNotice'
import { IconCheck, IconChevronLeft, IconChevronRight, IconClock, IconRotateCcw, IconShield } from '../components/icons'

type Decision = 'LIFT' | 'SHORTEN' | 'KEEP'

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'

const STATUS: Record<AdminAppealDetail['status'], { label: string; tone: string }> = {
  OPEN: { label: 'Needs review', tone: 'bg-brand/15 text-brand' },
  LIFTED: { label: 'Restriction lifted', tone: 'bg-success/12 text-success' },
  SHORTENED: { label: 'Restriction shortened', tone: 'bg-success/12 text-success' },
  KEPT: { label: 'Restriction kept', tone: 'bg-warning/15 text-warning' },
}

const DECISIONS: { key: Decision; title: string; body: string; icon: typeof IconCheck; template: TemplateKind }[] = [
  { key: 'LIFT', title: 'Lift it', body: 'They can sign in again right away.', icon: IconRotateCcw, template: 'appealLift' },
  { key: 'SHORTEN', title: 'Shorten it', body: 'Keep it, but end it sooner.', icon: IconClock, template: 'appealShorten' },
  { key: 'KEEP', title: 'Keep it', body: 'The restriction stays as it was.', icon: IconShield, template: 'appealKeep' },
]

const SHORTEN_TO: { label: string; hours: number }[] = [
  { label: '1 hour', hours: 1 },
  { label: '12 hours', hours: 12 },
  { label: '1 day', hours: 24 },
  { label: '3 days', hours: 72 },
]

/** Review one appeal and decide; the person is told the outcome with your note. */
const AdminAppeal = () => {
  const { appealId = '' } = useParams()
  const [appeal, setAppeal] = useState<AdminAppealDetail | null>(null)
  const [loadError, setLoadError] = useState('')
  const [decision, setDecision] = useState<Decision>('LIFT')
  const [note, setNote] = useState('')
  const [hours, setHours] = useState(24)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await getAppeal(appealId)
      setAppeal(res.appeal)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load that appeal')
    }
  }, [appealId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const submit = async () => {
    setError('')
    if (note.trim().length < 3) {
      setError('Write a short note — they’ll read it.')
      return
    }
    setBusy(true)
    try {
      const res = await decideAppeal(appealId, {
        decision,
        note: note.trim(),
        durationHours: decision === 'SHORTEN' ? hours : undefined,
      })
      setDone(res.message)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the decision')
    } finally {
      setBusy(false)
    }
  }

  const back = (
    <Link to="/admin/appeals" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
      <IconChevronLeft size={16} /> Appeals
    </Link>
  )

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        {back}
        <Alert>{loadError}</Alert>
      </div>
    )
  }
  if (!appeal) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <SkeletonCard lines={4} />
      </div>
    )
  }

  const name = appeal.user?.displayName || appeal.user?.username || 'Deleted user'
  const status = STATUS[appeal.status]
  const selected = DECISIONS.find((d) => d.key === decision)!

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {back}

      <section className="hero-card">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-lg font-bold text-brand-ink">
            {name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-extrabold tracking-tight text-ink">Appeal from {name}</h1>
            <p className="truncate text-sm text-muted">
              {appeal.user ? `@${appeal.user.username} · ` : ''}sent {fmt(appeal.createdAt)}
              {appeal.previousAppeals > 0 && ` · ${appeal.previousAppeals} earlier appeal${appeal.previousAppeals === 1 ? '' : 's'}`}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.tone}`}>{status.label}</span>
        </div>
        {appeal.user && (
          <Link
            to={`/admin/users/${appeal.user.id}`}
            className="mt-3 inline-flex items-center gap-0.5 text-sm font-medium text-brand hover:underline"
          >
            Open their profile <IconChevronRight size={15} />
          </Link>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="section-title">The restriction</h2>
          <p className="mt-2 text-sm text-ink">“{appeal.restriction.reason}”</p>
          <p className="mt-1 text-xs text-muted">
            From {fmt(appeal.restriction.at)} · {appeal.restriction.until ? `until ${fmt(appeal.restriction.until)}` : 'until lifted'}
          </p>
          <p className="mt-2 text-xs font-medium text-muted">
            Now:{' '}
            {appeal.currentRestriction ? (
              <span className="text-warning">still restricted {describeUntil(appeal.currentRestriction.until)}</span>
            ) : (
              <span className="text-success">not restricted</span>
            )}
          </p>
        </Card>
        <Card>
          <h2 className="section-title">What they said</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-ink">“{appeal.message}”</p>
        </Card>
      </div>

      {done && (
        <div className="flex items-center gap-2 rounded-xl border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          <IconCheck size={16} /> {done}
        </div>
      )}

      {appeal.status === 'OPEN' ? (
        <Card>
          <h2 className="section-title">Your decision</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Decision">
            {DECISIONS.map((d) => {
              const Icon = d.icon
              const on = decision === d.key
              return (
                <button
                  key={d.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setDecision(d.key)}
                  className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors ${
                    on ? 'border-brand bg-brand/10' : 'border-line hover:bg-panel-2'
                  }`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${on ? 'bg-brand text-brand-ink' : 'bg-panel-2 text-muted'}`}>
                    <Icon size={15} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-ink">{d.title}</span>
                    <span className="block text-xs text-muted">{d.body}</span>
                  </span>
                </button>
              )
            })}
          </div>

          {decision === 'SHORTEN' && (
            <div className="mt-4">
              <span className="field-label">Ends in (from now)</span>
              <div className="flex flex-wrap gap-2">
                {SHORTEN_TO.map((o) => (
                  <button
                    key={o.hours}
                    type="button"
                    onClick={() => setHours(o.hours)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      hours === o.hours ? 'border-brand bg-brand text-brand-ink' : 'border-line text-muted hover:text-ink'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 space-y-2">
            <ReasonTemplates key={selected.template} kind={selected.template} value={note} onPick={setNote} />
            <label className="block">
              <span className="field-label">Note to {name}</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                maxLength={1000}
                className="input resize-y"
                placeholder="They'll read this with your decision."
              />
            </label>
          </div>

          <div className="mt-3 rounded-xl border border-dashed border-line bg-panel-2 px-3 py-2.5 text-xs text-muted">
            <p className="mb-1 font-semibold uppercase tracking-wider">What they'll see</p>
            <p className="text-sm font-semibold text-ink">
              {decision === 'LIFT'
                ? 'Your appeal was accepted'
                : decision === 'SHORTEN'
                  ? 'Your appeal was reviewed — restriction shortened'
                  : 'Your appeal was reviewed'}
            </p>
            <p className="mt-0.5 whitespace-pre-line text-sm text-muted">
              {decision === 'LIFT'
                ? 'Your restriction has been lifted — welcome back to Fico.'
                : decision === 'SHORTEN'
                  ? `Your restriction now ends in ${SHORTEN_TO.find((o) => o.hours === hours)?.label}.`
                  : 'After looking at it again, the restriction stays as it was.'}
              {note.trim() ? `\n\n${note.trim()}` : ''}
            </p>
          </div>

          {error && (
            <div className="mt-3">
              <Alert>{error}</Alert>
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <Button variant={decision === 'KEEP' ? 'default' : 'primary'} disabled={busy} onClick={() => void submit()}>
              {busy ? 'Sending…' : 'Send decision'}
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <h2 className="section-title">Decision</h2>
          <p className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold ${status.tone}`}>{status.label}</p>
          {appeal.newUntil && <p className="mt-2 text-sm text-ink">New end: {fmt(appeal.newUntil)}</p>}
          {appeal.decisionNote && <p className="mt-2 whitespace-pre-line text-sm text-ink">“{appeal.decisionNote}”</p>}
          <p className="mt-2 text-xs text-muted">
            By {appeal.decidedBy ?? 'an admin'} · {fmt(appeal.decidedAt)}
          </p>
        </Card>
      )}
    </div>
  )
}

export default AdminAppeal
