import { useState } from 'react'
import type { FormEvent } from 'react'
import { forgotPassword } from '../services/authService'
import AuthLink from '../components/auth/AuthLink'
import { friendlyAuthError } from '../components/auth/authErrors'
import { useAuthNav } from '../components/auth/authNav'
import { IconCheck, IconLock } from '../components/icons'

const ForgotPassword = () => {
  const { swap } = useAuthNav()
  const [identifier, setIdentifier] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      // Always the same generic message either way — the backend never
      // reveals whether an account actually matched.
      await forgotPassword(identifier.trim())
      swap(() => setSent(true))
    } catch (err) {
      setError(friendlyAuthError(err, 'Something went wrong'))
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="card space-y-4 p-5 text-center sm:p-7">
        <span data-auth-item="" className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
          <IconCheck size={26} />
        </span>
        <div data-auth-item="">
          <h1 className="text-2xl font-bold tracking-tight text-ink">Check your inbox</h1>
          <p className="mt-1 text-sm text-muted">
            If an account matches <span className="font-medium text-ink">{identifier.trim()}</span>, an email is on its
            way with a link to choose a new password. It can take a few minutes — peek in spam too.
          </p>
        </div>
        <AuthLink to="/login" className="btn btn-primary w-full py-2.5">
          Back to sign in
        </AuthLink>
      </div>
    )
  }

  return (
    <div className="card space-y-5 p-5 sm:p-7">
      <div data-auth-item="" className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-ink">
          <IconLock size={20} />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Forgot your password?</h1>
          <p className="text-sm text-muted">It happens. We'll email you a link to pick a new one.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label data-auth-item="" className="block">
          <span className="field-label">Username or email</span>
          <input
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            required
            className="input"
          />
        </label>

        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <button data-auth-item="" type="submit" disabled={loading} className="btn btn-primary w-full py-2.5">
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <p data-auth-item="" className="text-center text-sm text-muted">
        Remembered it?{' '}
        <AuthLink to="/login" className="font-semibold text-brand hover:underline">
          Back to sign in
        </AuthLink>
      </p>
    </div>
  )
}

export default ForgotPassword
