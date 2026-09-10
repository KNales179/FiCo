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
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold">
            Fico
          </h1>

          <p className="mt-2 text-gray-500">
            Your Daily Financial Companion
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          <div>
            <label
              htmlFor="identifier"
              className="mb-2 block text-sm font-medium"
            >
              Username or email
            </label>

            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(event) =>
                setIdentifier(event.target.value)
              }
              autoComplete="username"
              required
              className="w-full border px-4 py-3 outline-none focus:ring-2"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              autoComplete="current-password"
              required
              className="w-full border px-4 py-3 outline-none focus:ring-2"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="text-sm"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full border px-4 py-3 font-medium disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-sm text-gray-500">
          Don't have an account?{' '}
          <Link
            to="/register"
            className="font-medium underline"
          >
            Create one
          </Link>
        </p>
      </div>
    </main>
  )
}

export default Login