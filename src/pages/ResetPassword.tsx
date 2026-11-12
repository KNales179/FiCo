import { useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { resetPassword } from '../services/authService'
import AuthLink from '../components/auth/AuthLink'
import PasswordInput from '../components/auth/PasswordInput'
import { friendlyAuthError } from '../components/auth/authErrors'
import { useAuthNav } from '../components/auth/authNav'
import { IconCheck, IconLock } from '../components/icons'

const ResetPassword = () => {
  const { swap } = useAuthNav()
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

    if (newPassword.length < 8) {
      setError('Your new password needs at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match")
      return
    }

    setLoading(true)
    try {
      await resetPassword(token, newPassword)
      swap(() => setDone(true))
    } catch (err) {
      setError(friendlyAuthError(err, 'Could not reset password'))
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="card space-y-4 p-5 sm:p-7">
        <h1 data-auth-item="" className="text-2xl font-bold tracking-tight text-ink">
          That link isn't complete
        </h1>
        <p data-auth-item="" className="text-sm text-muted">
          It's missing its token — open it straight from the email, or request a new one.
        </p>
        <AuthLink to="/forgot-password" className="btn btn-primary w-full py-2.5">
          Request a new link
        </AuthLink>
      </div>
    )
  }

  if (done) {
    return (
      <div className="card space-y-4 p-5 text-center sm:p-7">
        <span data-auth-item="" className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
          <IconCheck size={26} />
        </span>
        <div data-auth-item="">
          <h1 className="text-2xl font-bold tracking-tight text-ink">Password changed</h1>
          <p className="mt-1 text-sm text-muted">
            Every device has been signed out — sign in fresh with your new password.
          </p>
        </div>
        <AuthLink to="/login" className="btn btn-primary w-full py-2.5">
          Sign in
        </AuthLink>
      </div>
    )
  }

  const matches = confirmPassword.length > 0 && confirmPassword === newPassword

  return (
    <div className="card space-y-5 p-5 sm:p-7">
      <div data-auth-item="" className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-ink">
          <IconLock size={20} />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Choose a new password</h1>
          <p className="text-sm text-muted">At least 8 characters.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label data-auth-item="" className="block">
          <span className="field-label">New password</span>
          <PasswordInput
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            autoFocus
            required
          />
        </label>

        <label data-auth-item="" className="block">
          <span className="field-label">Confirm new password</span>
          <PasswordInput
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            required
            className={matches ? 'border-success' : ''}
          />
          {confirmPassword.length > 0 && (
            <span className={`mt-1.5 flex items-center gap-1 text-xs font-medium ${matches ? 'text-success' : 'text-danger'}`}>
              {matches ? (
                <>
                  <IconCheck size={14} /> Passwords match
                </>
              ) : (
                "Passwords don't match yet"
              )}
            </span>
          )}
        </label>

        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <button data-auth-item="" type="submit" disabled={loading} className="btn btn-primary w-full py-2.5">
          {loading ? 'Saving…' : 'Save new password'}
        </button>
      </form>
    </div>
  )
}

export default ResetPassword
