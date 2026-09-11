import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { devResetPassword } from '../services/authService'

/**
 * TEMPORARY — a self-service recovery tool for the Sept 2026 database
 * migration lockout. No current password needed, on purpose: that's the
 * whole reason it exists. Delete this file, its route in `App.tsx`, the
 * link on the Login page, and everything backend/dev-reset-password once
 * real (email-based) password reset ships.
 */
const DevResetPassword = () => {
  const [identifier, setIdentifier] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (newPassword !== confirm) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const res = await devResetPassword(identifier, newPassword)
      setMessage(res.message)
      setNewPassword('')
      setConfirm('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          ⚠️ Temporary recovery tool — this will be removed once real
          password reset ships. Don't rely on this link staying around.
        </div>

        <h1 className="page-title mb-4">Reset your password</h1>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <label className="block">
            <span className="field-label">Username or email</span>
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              required
              className="input"
            />
          </label>

          <label className="block">
            <span className="field-label">New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              className="input"
            />
          </label>

          <label className="block">
            <span className="field-label">Confirm new password</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
          {message && <p className="text-sm text-success">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full py-2.5"
          >
            {loading ? 'Resetting…' : 'Reset password'}
          </button>
        </form>

        <p className="mt-6 text-sm text-muted">
          <Link to="/login" className="font-medium text-brand underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  )
}

export default DevResetPassword
