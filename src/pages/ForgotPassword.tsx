import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../services/authService'

const ForgotPassword = () => {
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
      await forgotPassword(identifier)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            Reset your password
          </h1>
          <p className="mt-2 text-muted">
            Enter your username or email and we'll send a link to pick a new one.
          </p>
        </div>

        {sent ? (
          <div className="card space-y-3">
            <p className="text-sm text-success">
              If an account matches that, an email is on its way with instructions.
            </p>
            <Link to="/login" className="font-medium text-brand underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card space-y-4">
            <label className="block">
              <span className="field-label">Username or email</span>
              <input
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                autoComplete="username"
                autoFocus
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
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="mt-6 text-sm text-muted">
          <Link to="/login" className="font-medium text-brand underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  )
}

export default ForgotPassword
