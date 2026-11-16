import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { ApiError } from '../lib/api'
import AuthLink from '../components/auth/AuthLink'
import GoogleButton from '../components/auth/GoogleButton'
import PasswordInput from '../components/auth/PasswordInput'
import { friendlyAuthError } from '../components/auth/authErrors'
import { useAuthNav } from '../components/auth/authNav'
import { IconCloudOff, IconCompass, IconShield } from '../components/icons'
import { loadUnsyncedOwner, type UnsyncedOwner } from '../features/auth/localAuth'
import { clearJustSignedOut } from '../features/auth/returning'

const Login = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, verifyTwoFactor, startDemo } = useAuth()
  const { swap } = useAuthNav()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [demoBusy, setDemoBusy] = useState(false)
  // Changes kept from a sign-out the person didn't choose (session expired while offline).
  const [kept, setKept] = useState<UnsyncedOwner | null>(null)
  useEffect(() => {
    void loadUnsyncedOwner().then(setKept).catch(() => undefined)
    // Shown the sign-in screen after signing out: next time "/" is the front page again.
    clearJustSignedOut()
  }, [])

  const tryDemo = async () => {
    setError('')
    setDemoBusy(true)
    try {
      await startDemo()
      navigate('/', { replace: true })
    } catch {
      setError('Could not start the demo on this device — try again.')
      setDemoBusy(false)
    }
  }

  // Set only once the password (or Google) checks out and the account still needs a code.
  // (Also handed over by the sign-up screen when a Google account there has 2FA on.)
  const [pendingToken, setPendingToken] = useState<string | null>(
    () => (location.state as { pendingToken?: string } | null)?.pendingToken ?? null,
  )
  const [code, setCode] = useState('')

  const toCodeStep = (token: string) =>
    swap(() => {
      setError('')
      setPendingToken(token)
    })

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await login(identifier.trim(), password)
      if (result?.requiresTwoFactor) toCodeStep(result.pendingToken)
      else navigate('/', { replace: true })
    } catch (err) {
      // Restricted / deleted by an admin: the pop-up explains it (api.ts saved the notice).
      if (err instanceof ApiError && err.notice) setError('')
      else setError(friendlyAuthError(err, 'Unable to sign in'))
    } finally {
      setLoading(false)
    }
  }

  const handleCodeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!pendingToken) return
    setError('')
    setLoading(true)
    try {
      await verifyTwoFactor(pendingToken, code.trim())
      navigate('/', { replace: true })
    } catch (err) {
      setError(friendlyAuthError(err, 'Invalid code'))
    } finally {
      setLoading(false)
    }
  }

  if (pendingToken) {
    return (
      <form onSubmit={handleCodeSubmit} className="card space-y-4 p-5 sm:p-7">
        <div data-auth-item="" className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-brand-ink">
            <IconShield size={20} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-ink">Two-step check</h1>
            <p className="text-sm text-muted">One more step to keep your account safe.</p>
          </div>
        </div>
        <label data-auth-item="" className="block">
          <span className="field-label">Authenticator code</span>
          <input
            id="code"
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            inputMode="text"
            autoComplete="one-time-code"
            placeholder="123456"
            autoFocus
            required
            className="input text-center font-mono text-lg tracking-[0.3em]"
          />
          <span className="mt-1.5 block text-xs text-muted">
            The 6-digit code from your authenticator app, or one of your backup codes.
          </span>
        </label>

        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <button data-auth-item="" type="submit" disabled={loading} className="btn btn-primary w-full py-2.5">
          {loading ? 'Verifying…' : 'Verify'}
        </button>
        <button
          data-auth-item=""
          type="button"
          onClick={() =>
            swap(() => {
              setPendingToken(null)
              setCode('')
              setError('')
            }, -1)
          }
          className="w-full text-center text-sm text-muted underline"
        >
          Back to sign in
        </button>
      </form>
    )
  }

  return (
    <div className="card space-y-5 p-5 sm:p-7">
      <div data-auth-item="">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">Sign in to pick up right where you left off.</p>
      </div>

      {kept && (
        <div data-auth-item="" className="flex items-start gap-3 rounded-xl border border-brand/30 bg-brand/[0.06] px-3.5 py-3 text-sm">
          <IconCloudOff size={18} className="mt-0.5 shrink-0 text-brand" />
          <p className="text-ink">
            <span className="font-semibold">
              {kept.count} change{kept.count === 1 ? '' : 's'} saved on this device
            </span>{' '}
            {kept.count === 1 ? 'hasn’t' : 'haven’t'} synced yet. Sign in
            {kept.username ? (
              <>
                {' '}as <span className="font-semibold">@{kept.username}</span>
              </>
            ) : null}{' '}
            and {kept.count === 1 ? 'it' : 'they'}’ll be sent up automatically — nothing was lost.
          </p>
        </div>
      )}

      <form onSubmit={handlePasswordSubmit} className="space-y-4">
        <label data-auth-item="" className="block">
          <span className="field-label">Username or email</span>
          <input
            id="identifier"
            type="text"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            className="input"
          />
        </label>

        <label data-auth-item="" className="block">
          <span className="flex items-baseline justify-between">
            <span className="field-label">Password</span>
            <AuthLink to="/forgot-password" className="text-xs font-medium text-brand hover:underline">
              Forgot password?
            </AuthLink>
          </span>
          <PasswordInput
            id="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <button data-auth-item="" type="submit" disabled={loading || googleBusy || demoBusy} className="btn btn-primary w-full py-2.5">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div data-auth-item="" className="space-y-1.5">
        <button
          type="button"
          onClick={() => void tryDemo()}
          disabled={loading || demoBusy}
          className="btn w-full py-2.5"
        >
          <IconCompass size={16} />
          {demoBusy ? 'Setting up the demo…' : 'Try the demo'}
        </button>
        <p className="text-center text-xs text-muted">
          No sign-up needed — explore every feature with sample data. It stays on this device and
          disappears when you exit.
        </p>
      </div>

      <div data-auth-item="">
        <GoogleButton mode="signin" onTwoFactor={toCodeStep} onError={setError} onBusyChange={setGoogleBusy} />
      </div>

      <p data-auth-item="" className="text-center text-sm text-muted">
        New to Fico?{' '}
        <AuthLink to="/register" className="font-semibold text-brand hover:underline">
          Create an account
        </AuthLink>
      </p>
    </div>
  )
}

export default Login
