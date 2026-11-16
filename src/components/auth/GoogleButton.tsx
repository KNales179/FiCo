import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { effectiveTheme, subscribeTheme } from '../../features/theme'
import { friendlyAuthError } from './authErrors'
import { clearGoogleHandler, GOOGLE_CLIENT_ID, renderGoogleButton } from './googleIdentity'

type Props = {
  mode: 'signin' | 'signup'
  /** The Google account has 2FA on — finish with the code step. */
  onTwoFactor?: (pendingToken: string) => void
  onError: (message: string) => void
  onBusyChange?: (busy: boolean) => void
  /** Sign-up page: the invite code typed above, needed to create a new account. */
  inviteCode?: string
}

/**
 * "Continue with Google", under an "or" divider. Renders nothing when
 * Google sign-in isn't configured, or Google's script can't load (offline).
 * A new Google user gets an account straight away — the line under the
 * button is their agreement to the Terms, same as the sign-up checkbox.
 */
const GoogleButton = ({ mode, onTwoFactor, onError, onBusyChange, inviteCode }: Props) => {
  const { googleSignIn } = useAuth()
  const navigate = useNavigate()
  const slotRef = useRef<HTMLDivElement>(null)
  const theme = useSyncExternalStore(subscribeTheme, effectiveTheme, () => 'light' as const)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [busy, setBusy] = useState(false)

  // Kept in a ref so re-renders don't make Google re-draw its button.
  const latest = useRef({ onTwoFactor, onError, onBusyChange, inviteCode })
  useEffect(() => {
    latest.current = { onTwoFactor, onError, onBusyChange, inviteCode }
  })

  const handleCredential = useCallback(
    async (credential: string) => {
      setBusy(true)
      latest.current.onBusyChange?.(true)
      latest.current.onError('')
      try {
        const result = await googleSignIn(credential, true, latest.current.inviteCode)
        if (result?.requiresTwoFactor) latest.current.onTwoFactor?.(result.pendingToken)
        else navigate('/', { replace: true })
      } catch (error) {
        latest.current.onError(friendlyAuthError(error, 'Google sign-in failed — please try again.'))
      } finally {
        setBusy(false)
        latest.current.onBusyChange?.(false)
      }
    },
    [googleSignIn, navigate],
  )

  useEffect(() => {
    const slot = slotRef.current
    if (!GOOGLE_CLIENT_ID || !slot) return
    let cancelled = false
    const width = Math.round(Math.min(400, Math.max(220, slot.clientWidth || 320)))
    renderGoogleButton(
      slot,
      {
        type: 'standard',
        theme: theme === 'dark' ? 'filled_black' : 'outline',
        size: 'large',
        shape: 'pill',
        text: mode === 'signup' ? 'signup_with' : 'continue_with',
        logo_alignment: 'center',
        locale: 'en',
        width,
      },
      handleCredential,
    )
      .then(() => !cancelled && setState('ready'))
      .catch(() => !cancelled && setState('failed'))
    return () => {
      cancelled = true
      clearGoogleHandler(handleCredential)
    }
  }, [theme, mode, handleCredential])

  if (!GOOGLE_CLIENT_ID || state === 'failed') return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-muted">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
      <div className="relative flex min-h-[44px] justify-center">
        {state === 'loading' && (
          <div className="absolute inset-0 animate-pulse rounded-full border border-line bg-panel-2" aria-hidden="true" />
        )}
        <div
          ref={slotRef}
          className={['flex w-full justify-center transition-opacity', busy ? 'pointer-events-none opacity-50' : ''].join(' ')}
          aria-busy={busy}
        />
      </div>
      <p className="text-center text-[11px] leading-snug text-muted">
        {busy ? (
          'Signing you in with Google…'
        ) : (
          <>
            By continuing with Google you agree to Fico's{' '}
            <Link to="/terms" target="_blank" className="underline">
              Terms
            </Link>{' '}
            and{' '}
            <Link to="/privacy" target="_blank" className="underline">
              Privacy Policy
            </Link>
            .
          </>
        )}
      </p>
    </div>
  )
}

export default GoogleButton
