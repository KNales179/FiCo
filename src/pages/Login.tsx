import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const Login = () => {
  const navigate = useNavigate()
  const { login, verifyTwoFactor } = useAuth()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Set only once the password checks out and the account still needs a code.
  const [pendingToken, setPendingToken] = useState<string | null>(null)
  const [code, setCode] = useState('')

  const handlePasswordSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    setError('')
    setLoading(true)

    try {
      const result = await login(identifier, password)
      if (result?.requiresTwoFactor) {
        setPendingToken(result.pendingToken)
      } else {
        navigate('/', { replace: true })
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Unable to log in',
      )
    } finally {
      setLoading(false)
    }
  }

  const handleCodeSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()
    if (!pendingToken) return

    setError('')
    setLoading(true)

    try {
      await verifyTwoFactor(pendingToken, code)
      navigate('/', { replace: true })
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Invalid code',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <div className="flex items-center gap-2.5">
            <img src="/icon-192.png" alt="" className="h-10 w-10 rounded-lg" />
            <h1 className="text-3xl font-semibold tracking-tight text-brand">
              Fico
            </h1>
          </div>
          <p className="mt-2 text-muted">Your Daily Financial Companion</p>
        </div>

        {pendingToken ? (
          <form onSubmit={handleCodeSubmit} className="card space-y-4">
            <div>
              <span className="field-label">Authenticator code</span>
              <p className="mt-1 text-xs text-muted">
                Enter the 6-digit code from your authenticator app, or one of
                your backup codes.
              </p>
              <input
                id="code"
                type="text"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                inputMode="text"
                autoComplete="one-time-code"
                autoFocus
                required
                className="input mt-2"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-2.5"
            >
              {loading ? 'Verifying…' : 'Verify'}
            </button>

            <button
              type="button"
              onClick={() => {
                setPendingToken(null)
                setCode('')
                setError('')
              }}
              className="w-full text-center text-sm text-muted underline"
            >
              Back to sign in
            </button>
          </form>
        ) : (
          <form onSubmit={handlePasswordSubmit} className="card space-y-4">
            <label className="block">
              <span className="field-label">Username or email</span>
              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                autoComplete="username"
                required
                className="input"
              />
            </label>

            <label className="block">
              <span className="field-label">Password</span>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                className="input"
              />
            </label>

            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-2.5"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>

            <p className="text-center text-sm">
              <Link to="/forgot-password" className="text-muted underline">
                Forgot your password?
              </Link>
            </p>
          </form>
        )}

        <p className="mt-6 text-sm text-muted">
          Don't have an account?{' '}
          <Link to="/register" className="font-medium text-brand underline">
            Create one
          </Link>
        </p>

        <p className="mt-4 flex gap-3 text-xs text-muted">
          <Link to="/terms" className="underline">
            Terms
          </Link>
          <Link to="/privacy" className="underline">
            Privacy
          </Link>
        </p>
      </div>
    </main>
  )
}

export default Login
