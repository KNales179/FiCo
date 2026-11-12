import { useEffect, useRef, useState } from 'react'
import { gsap, prefersReducedMotion } from '../../lib/motion'
import {
  AUTH_NOTICE_EVENT,
  clearAuthNotice,
  describeUntil,
  loadAuthNotice,
  saveAuthNotice,
  type AppealSummary,
  type AuthNotice,
} from '../../features/auth/authNotice'
import { sendAppeal } from '../../services/appealService'
import { IconClock, IconLock, IconLogOut, IconMessage, IconShield, IconTrash } from '../icons'

const current = (): AuthNotice | null => {
  const n = loadAuthNotice()
  // A restriction that has already run out isn't worth a pop-up any more.
  if (n?.code === 'ACCOUNT_RESTRICTED' && n.until && new Date(n.until).getTime() < Date.now()) {
    clearAuthNotice()
    return null
  }
  return n
}

const APPEAL_STATUS: Record<AppealSummary['status'], { label: string; tone: string }> = {
  OPEN: { label: 'Waiting for review', tone: 'text-brand' },
  LIFTED: { label: 'Accepted — restriction lifted', tone: 'text-success' },
  SHORTENED: { label: 'Reviewed — restriction shortened', tone: 'text-success' },
  KEPT: { label: 'Reviewed — restriction stays', tone: 'text-warning' },
}

/**
 * Under a restriction: appeal it (with the token a correct-password sign-in
 * returned), or see where an earlier appeal stands.
 */
const AppealSection = ({ notice }: { notice: AuthNotice }) => {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState<AppealSummary | null>(notice.appeal?.existing ?? null)

  if (sent) {
    const look = APPEAL_STATUS[sent.status]
    return (
      <div className="mt-4 rounded-xl border border-line bg-panel-2 px-4 py-3 text-left">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Your appeal</p>
        <p className={`mt-1 text-sm font-semibold ${look.tone}`}>{look.label}</p>
        {sent.decisionNote && <p className="mt-1 whitespace-pre-line text-sm text-ink">“{sent.decisionNote}”</p>}
        {sent.status === 'OPEN' && (
          <p className="mt-1 text-xs text-muted">
            The team will look at it soon. Try signing in again later to see their decision.
          </p>
        )}
      </div>
    )
  }

  if (!notice.appeal) {
    return (
      <p className="mt-3 text-xs text-muted">
        Think this is a mistake? Sign in with your password and you’ll be able to send an appeal.
      </p>
    )
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn mt-4 w-full py-2">
        <IconMessage size={15} /> Appeal this decision
      </button>
    )
  }

  const submit = async () => {
    setError('')
    if (message.trim().length < 10) {
      setError('Tell the team a little more — at least a sentence.')
      return
    }
    setBusy(true)
    try {
      const res = await sendAppeal(notice.appeal!.token, message.trim())
      setSent(res.appeal)
      saveAuthNotice({ ...notice, appeal: { ...notice.appeal!, existing: res.appeal } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your appeal')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 space-y-2 text-left">
      <label className="block">
        <span className="field-label">Your appeal</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          maxLength={2000}
          autoFocus
          placeholder="Explain what happened and why you think the restriction should be lifted or shortened."
          className="input resize-y"
        />
      </label>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn flex-1" disabled={busy}>
          Cancel
        </button>
        <button type="button" onClick={() => void submit()} className="btn btn-primary flex-1" disabled={busy}>
          {busy ? 'Sending…' : 'Send appeal'}
        </button>
      </div>
      <p className="text-[11px] text-muted">One appeal per restriction. The team will tell you their decision.</p>
    </div>
  )
}

const LOOK: Record<string, { icon: typeof IconLock; tone: string; title: string }> = {
  ADMIN_SIGN_OUT: { icon: IconLogOut, tone: 'text-brand bg-brand/12', title: 'You have been signed out' },
  ACCOUNT_RESTRICTED: { icon: IconClock, tone: 'text-warning bg-warning/15', title: 'Your account is restricted' },
  ACCOUNT_DELETED: { icon: IconTrash, tone: 'text-danger bg-danger/12', title: 'Your account has been deleted' },
  ADMIN_PASSWORD_RESET: { icon: IconLock, tone: 'text-brand bg-brand/12', title: 'Your password was changed' },
  ADMIN_2FA_RESET: { icon: IconShield, tone: 'text-brand bg-brand/12', title: 'Two-step sign-in was turned off' },
}

/**
 * On the sign-in screens: when an admin signed this device out, restricted
 * or deleted the account (or reset its password / 2FA), say so — with the
 * reason they gave and, for a restriction, how long it lasts.
 */
const AuthNoticeDialog = () => {
  const [notice, setNotice] = useState<AuthNotice | null>(current)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onNotice = () => setNotice(current())
    window.addEventListener(AUTH_NOTICE_EVENT, onNotice)
    return () => window.removeEventListener(AUTH_NOTICE_EVENT, onNotice)
  }, [])

  useEffect(() => {
    const el = cardRef.current
    if (!notice || !el || prefersReducedMotion()) return
    const tween = gsap.fromTo(
      el,
      { y: 24, scale: 0.96, autoAlpha: 0 },
      { y: 0, scale: 1, autoAlpha: 1, duration: 0.45, ease: 'back.out(1.6)', clearProps: 'transform,opacity,visibility' },
    )
    return () => {
      tween.kill()
    }
    // Animate in once per notice, not again when an appeal updates it.
  }, [notice?.at]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!notice) return null
  const look = LOOK[notice.code] ?? LOOK.ADMIN_SIGN_OUT
  const Icon = look.icon

  const dismiss = () => {
    clearAuthNotice()
    setNotice(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <button type="button" aria-label="Close" className="fixed inset-0 cursor-default" onClick={dismiss} />
      <div
        ref={cardRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="auth-notice-title"
        className="relative max-h-[92dvh] w-full max-w-sm overflow-y-auto rounded-3xl border border-line bg-panel p-6 text-center shadow-2xl"
      >
        <span className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${look.tone}`}>
          <Icon size={26} />
        </span>
        <h2 id="auth-notice-title" className="mt-4 text-xl font-bold tracking-tight text-ink">
          {look.title}
        </h2>
        {!LOOK[notice.code] && <p className="mt-1 text-sm text-muted">{notice.message}</p>}

        {notice.reason && (
          <div className="mt-4 rounded-xl border border-line bg-panel-2 px-4 py-3 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Reason</p>
            <p className="mt-1 whitespace-pre-line text-sm text-ink">{notice.reason}</p>
          </div>
        )}

        {notice.code === 'ACCOUNT_RESTRICTED' && (
          <>
            <p className="mt-3 text-sm text-ink">
              You can't sign in <span className="font-semibold">{describeUntil(notice.until)}</span>.
            </p>
            <AppealSection notice={notice} />
          </>
        )}
        {notice.code === 'ACCOUNT_DELETED' && (
          <p className="mt-3 text-xs text-muted">
            If you think this is a mistake, contact whoever invited you to Fico.
          </p>
        )}

        <p className="mt-3 text-xs text-muted">— Fico Admin Team</p>
        <button type="button" onClick={dismiss} autoFocus className="btn btn-primary mt-5 w-full py-2.5">
          Okay
        </button>
      </div>
    </div>
  )
}

export default AuthNoticeDialog
