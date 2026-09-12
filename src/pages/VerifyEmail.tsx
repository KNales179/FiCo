import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { verifyEmail } from '../services/authService'

type Status = 'checking' | 'done' | 'error'

const VerifyEmail = () => {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [status, setStatus] = useState<Status>(token ? 'checking' : 'error')
  const [message, setMessage] = useState('')
  const ran = useRef(false)

  useEffect(() => {
    if (!token || ran.current) return
    ran.current = true
    void verifyEmail(token)
      .then((res) => {
        setStatus('done')
        setMessage(res.message)
      })
      .catch((err: unknown) => {
        setStatus('error')
        setMessage(err instanceof Error ? err.message : 'Could not verify that link')
      })
  }, [token])

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            Verify your email
          </h1>
        </div>

        <div className="card space-y-3">
          {status === 'checking' && <p className="text-sm text-muted">Checking…</p>}
          {status === 'done' && <p className="text-sm text-success">{message}</p>}
          {status === 'error' && (
            <p className="text-sm text-danger">
              {message || 'That link is missing its token.'}
            </p>
          )}
          <Link to="/" className="font-medium text-brand underline">
            Go to Fico
          </Link>
        </div>
      </div>
    </main>
  )
}

export default VerifyEmail
