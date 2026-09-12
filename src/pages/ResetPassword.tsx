import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { resetPassword } from '../services/authService'

const ResetPassword = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      await resetPassword(token, newPassword)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            Choose a new password
          </h1>
        </div>

        {!token ? (
          <div className="card space-y-3">
            <p className="text-sm text-danger">
              That link is missing its token — open it directly from the
              email, or request a new one.
            </p>
            <Link to="/forgot-password" className="font-medium text-brand underline">
              Request a new link
            </Link>
          </div>
        ) : done ? (
          <div className="card space-y-3">
            <p className="text-sm text-success">
              Password reset. Every device is signed out — sign in fresh with
              your new password.
            </p>
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="btn btn-primary w-full py-2.5"
            >
              Sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card space-y-4">
            <label className="block">
              <span className="field-label">New password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                autoFocus
                required
                className="input"
              />
            </label>

            <label className="block">
              <span className="field-label">Confirm new password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
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
              {loading ? 'Saving…' : 'Reset password'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}

export default ResetPassword
