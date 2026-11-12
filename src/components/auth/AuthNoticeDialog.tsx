import { useEffect, useRef, useState } from 'react'
import { gsap, prefersReducedMotion } from '../../lib/motion'
import {
  AUTH_NOTICE_EVENT,
  clearAuthNotice,
  describeUntil,
  loadAuthNotice,
  type AuthNotice,
} from '../../features/auth/authNotice'
import { IconClock, IconLock, IconLogOut, IconShield, IconTrash } from '../icons'

const current = (): AuthNotice | null => {
  const n = loadAuthNotice()
  // A restriction that has already run out isn't worth a pop-up any more.
  if (n?.code === 'ACCOUNT_RESTRICTED' && n.until && new Date(n.until).getTime() < Date.now()) {
    clearAuthNotice()
    return null
  }
  return n
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
  }, [notice])

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
        className="relative w-full max-w-sm rounded-3xl border border-line bg-panel p-6 text-center shadow-2xl"
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
          <p className="mt-3 text-sm text-ink">
            You can't sign in <span className="font-semibold">{describeUntil(notice.until)}</span>.
          </p>
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
