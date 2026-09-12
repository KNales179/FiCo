import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const Register = () => {
  const navigate = useNavigate()
  const { register } = useAuth()

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (!termsAccepted) {
      setError('You need to agree to the Terms & Conditions and Privacy Policy to create an account')
      return
    }

    setLoading(true)

    try {
      await register(
        username,
        email,
        password,
        termsAccepted,
      )

      navigate('/', { replace: true })
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Unable to create account',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            Create your Fico account
          </h1>
          <p className="mt-2 text-muted">Your Daily Financial Companion</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <label className="block">
            <span className="field-label">Username</span>
            <input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
              className="input"
            />
          </label>

          <label className="block">
            <span className="field-label">Email</span>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
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
              autoComplete="new-password"
              required
              className="input"
            />
          </label>

          <label className="block">
            <span className="field-label">Confirm password</span>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
              className="input"
            />
          </label>

          <p className="rounded-lg border border-line bg-panel-2 px-3 py-2 text-xs text-muted">
            Fico is a personal record-keeping tool — it isn't connected to
            GCash, your bank, or any other financial institution. Nothing
            here reflects your real, live balance, and small mismatches
            between what's recorded here and your actual accounts are
            expected, not a bug.
          </p>

          <label className="flex items-start gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              required
              className="mt-0.5"
            />
            <span>
              I agree to the{' '}
              <Link to="/terms" target="_blank" className="font-medium text-brand underline">
                Terms & Conditions
              </Link>{' '}
              and{' '}
              <Link to="/privacy" target="_blank" className="font-medium text-brand underline">
                Privacy Policy
              </Link>
            </span>
          </label>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !termsAccepted}
            className="btn btn-primary w-full py-2.5"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-sm text-muted">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}

export default Register