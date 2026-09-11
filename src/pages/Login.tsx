import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const Login = () => {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    setError('')
    setLoading(true)

    try {
      await login(identifier, password)
      navigate('/', { replace: true })
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

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-brand">
            Fico
          </h1>
          <p className="mt-2 text-muted">Your Daily Financial Companion</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
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
        </form>

        <p className="mt-6 text-sm text-muted">
          Don't have an account?{' '}
          <Link to="/register" className="font-medium text-brand underline">
            Create one
          </Link>
        </p>
        {/* TEMPORARY — remove this link alongside DevResetPassword.tsx. */}
        <p className="mt-2 text-xs text-muted">
          <Link to="/dev-reset-password" className="underline">
            Locked out? Temporary password reset
          </Link>
        </p>
      </div>
    </main>
  )
}

export default Login