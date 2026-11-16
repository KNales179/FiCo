import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { ApiError } from '../lib/api'
import AuthLink from '../components/auth/AuthLink'
import GoogleButton from '../components/auth/GoogleButton'
import PasswordInput from '../components/auth/PasswordInput'
import { friendlyAuthError } from '../components/auth/authErrors'
import { IconCheck, IconLock, IconMail } from '../components/icons'

/** Where people ask for a beta tester code (the same address as on the Credits page). */
const BETA_EMAIL = 'ibelldev179@gmail.com'

type FieldName = 'inviteCode' | 'username' | 'email' | 'password' | 'confirmPassword' | 'termsAccepted'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// The same rules the server checks — caught here first, field by field,
// so nobody's left guessing why "Create account" didn't work.
const validate = (values: {
  inviteCode: string
  username: string
  email: string
  password: string
  confirmPassword: string
  termsAccepted: boolean
}): Partial<Record<FieldName, string>> => {
  const errors: Partial<Record<FieldName, string>> = {}
  const code = values.inviteCode.trim()
  if (!code) errors.inviteCode = 'Enter your invite code'
  else if (code.length > 40) errors.inviteCode = 'That doesn’t look like an invite code'

  const username = values.username.trim()
  if (!username) errors.username = 'Pick a username'
  else if (/\s/.test(username)) errors.username = 'No spaces — try an underscore instead, like juan_dela_cruz'
  else if (!/^[a-zA-Z0-9_]+$/.test(username)) errors.username = 'Only letters, numbers and underscores (no dots, dashes or symbols)'
  else if (username.length < 3) errors.username = 'At least 3 characters'
  else if (username.length > 30) errors.username = '30 characters at most'

  const email = values.email.trim()
  if (!email) errors.email = 'Enter your email'
  else if (!EMAIL_RE.test(email)) errors.email = "That doesn't look like an email address"
  else if (email.length > 100) errors.email = '100 characters at most'

  if (!values.password) errors.password = 'Choose a password'
  else if (values.password.length < 8) errors.password = `At least 8 characters (${8 - values.password.length} more)`
  else if (values.password.length > 128) errors.password = '128 characters at most'

  if (!values.confirmPassword) errors.confirmPassword = 'Type your password again'
  else if (values.confirmPassword !== values.password) errors.confirmPassword = "Passwords don't match"

  if (!values.termsAccepted) errors.termsAccepted = 'Please agree to the Terms & Conditions and Privacy Policy'
  return errors
}

const strengthOf = (password: string) => {
  if (!password) return 0
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++
  if (password.length < 8) return 1
  return Math.min(4, Math.max(1, score - 1))
}
const STRENGTH = [
  { label: '', color: '' },
  { label: 'Too weak', color: 'var(--danger)' },
  { label: 'Okay', color: 'var(--warning)' },
  { label: 'Good', color: 'var(--brand)' },
  { label: 'Strong', color: 'var(--success)' },
]

const FieldMessage = ({ id, children }: { id: string; children?: ReactNode }) =>
  children ? (
    <span id={id} role="alert" className="mt-1.5 block text-xs font-medium text-danger">
      {children}
    </span>
  ) : null

const Register = () => {
  const navigate = useNavigate()
  const { register } = useAuth()
  // An invite link (…/register?code=FICO-XXXX-XXXX) fills the code in.
  const [searchParams] = useSearchParams()

  const [inviteCode, setInviteCode] = useState(() => (searchParams.get('code') ?? '').toUpperCase().slice(0, 40))
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)

  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  // What the server said about a specific field (e.g. "That email already has an account").
  const [serverErrors, setServerErrors] = useState<Partial<Record<FieldName, string>>>({})
  const [emailTaken, setEmailTaken] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)

  const errors = validate({ inviteCode, username, email, password, confirmPassword, termsAccepted })
  const shown = (field: FieldName) =>
    serverErrors[field] ?? (submitted || touched[field] ? errors[field] : undefined)
  const touch = (field: FieldName) => () => setTouched((t) => ({ ...t, [field]: true }))
  const clearServer = (field: FieldName) => {
    if (serverErrors[field]) {
      setServerErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
    if (field === 'email') setEmailTaken(false)
  }

  const strength = strengthOf(password)
  const passwordsMatch = confirmPassword.length > 0 && confirmPassword === password

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)
    setError('')
    if (Object.keys(errors).length > 0) {
      // Jump to the first field that needs fixing.
      const first = (['inviteCode', 'username', 'email', 'password', 'confirmPassword', 'termsAccepted'] as const).find((f) => errors[f])
      document.getElementById(first === 'termsAccepted' ? 'terms' : first ?? '')?.focus()
      return
    }

    setLoading(true)
    try {
      await register(username.trim(), email.trim(), password, termsAccepted, inviteCode.trim())
      navigate('/', { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        const next: Partial<Record<FieldName, string>> = {}
        for (const [field, messages] of Object.entries(err.fieldErrors)) {
          if (messages?.[0]) next[field as FieldName] = messages[0]
        }
        setServerErrors(next)
        setEmailTaken(err.status === 409 && Boolean(next.email))
        // The field itself shows the reason; the banner only for anything else.
        if (Object.keys(next).length === 0) setError(err.message)
      } else {
        setError(friendlyAuthError(err, 'Unable to create your account'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card space-y-5 p-5 sm:p-7">
      <div data-auth-item="">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Create your account</h1>
        <p className="mt-1 text-sm text-muted">Private, and ready in under a minute — with your invite code.</p>
      </div>

      <div data-auth-item="" className="space-y-2 rounded-xl border border-brand/30 bg-brand/5 px-3.5 py-3 text-sm">
        <p className="flex items-center gap-2 font-semibold text-ink">
          <IconLock size={16} className="shrink-0 text-brand" />
          Sign-up is invite-only for now
        </p>
        <p className="text-muted">
          Fico is still in beta. While it’s being tested and readied for everyone, new accounts need a one-time
          invite code, which keeps the beta small enough to look after properly. Everyone who joins with a code
          gets the <span className="font-medium text-ink">Beta tester</span> badge.
        </p>
        <ul className="space-y-1.5 text-muted">
          <li className="flex items-start gap-2">
            <IconMail size={15} className="mt-0.5 shrink-0 text-brand" />
            <span>
              Want to help test Fico? Email{' '}
              <a
                href={`mailto:${BETA_EMAIL}?subject=${encodeURIComponent('Fico beta tester code')}`}
                className="font-medium text-brand underline"
              >
                {BETA_EMAIL}
              </a>{' '}
              and ask for a beta tester code.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <IconCheck size={15} className="mt-0.5 shrink-0 text-brand" />
            <span>Invited by a Fico admin? Ask them for your code.</span>
          </li>
        </ul>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <label data-auth-item="" className="block">
          <span className="field-label">Invite code</span>
          <input
            id="inviteCode"
            value={inviteCode}
            onChange={(e) => {
              setInviteCode(e.target.value.toUpperCase())
              clearServer('inviteCode')
            }}
            onBlur={touch('inviteCode')}
            placeholder="FICO-XXXX-XXXX"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={40}
            aria-invalid={Boolean(shown('inviteCode'))}
            aria-describedby="invite-msg"
            className={['input font-mono tracking-wider', shown('inviteCode') ? 'border-danger' : ''].join(' ')}
          />
          {shown('inviteCode') ? (
            <FieldMessage id="invite-msg">{shown('inviteCode')}</FieldMessage>
          ) : (
            <span id="invite-msg" className="mt-1.5 block text-xs text-muted">
              Each code works once, for 1 hour after it’s made.
            </span>
          )}
        </label>

        <label data-auth-item="" className="block">
          <span className="field-label">Username</span>
          <input
            id="username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              clearServer('username')
            }}
            onBlur={touch('username')}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={Boolean(shown('username'))}
            aria-describedby="username-msg"
            className={['input', shown('username') ? 'border-danger' : ''].join(' ')}
          />
          {shown('username') ? (
            <FieldMessage id="username-msg">{shown('username')}</FieldMessage>
          ) : (
            <span id="username-msg" className="mt-1.5 block text-xs text-muted">
              3–30 letters, numbers or underscores. This is how people in your shared Finances find you.
            </span>
          )}
        </label>

        <label data-auth-item="" className="block">
          <span className="field-label">Email</span>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              clearServer('email')
            }}
            onBlur={touch('email')}
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={Boolean(shown('email'))}
            aria-describedby="email-msg"
            className={['input', shown('email') ? 'border-danger' : ''].join(' ')}
          />
          <FieldMessage id="email-msg">
            {shown('email')}
            {emailTaken && (
              <span className="mt-1 block font-normal text-muted">
                Is it yours?{' '}
                <AuthLink to="/login" className="font-semibold text-brand underline">
                  Sign in
                </AuthLink>{' '}
                or{' '}
                <AuthLink to="/forgot-password" className="font-semibold text-brand underline">
                  reset your password
                </AuthLink>
                .
              </span>
            )}
          </FieldMessage>
        </label>

        <div data-auth-item="">
          <label className="block">
            <span className="field-label">Password</span>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                clearServer('password')
              }}
              onBlur={touch('password')}
              autoComplete="new-password"
              aria-invalid={Boolean(shown('password'))}
              aria-describedby="password-msg"
              className={shown('password') ? 'border-danger' : ''}
            />
          </label>
          {password && (
            <div className="mt-2 flex items-center gap-2" aria-live="polite">
              <div className="flex flex-1 gap-1">
                {[1, 2, 3, 4].map((n) => (
                  <span
                    key={n}
                    className="strength-bar"
                    style={n <= strength ? { backgroundColor: STRENGTH[strength].color } : undefined}
                  />
                ))}
              </div>
              <span className="w-16 text-right text-xs font-medium" style={{ color: STRENGTH[strength].color }}>
                {STRENGTH[strength].label}
              </span>
            </div>
          )}
          {shown('password') ? (
            <FieldMessage id="password-msg">{shown('password')}</FieldMessage>
          ) : (
            <span id="password-msg" className="mt-1.5 block text-xs text-muted">
              At least 8 characters. A longer phrase is easier to remember and harder to guess.
            </span>
          )}
        </div>

        <label data-auth-item="" className="block">
          <span className="field-label">Confirm password</span>
          <PasswordInput
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                clearServer('confirmPassword')
              }}
              onBlur={touch('confirmPassword')}
              autoComplete="new-password"
              aria-invalid={Boolean(shown('confirmPassword'))}
              aria-describedby="confirm-msg"
              className={shown('confirmPassword') ? 'border-danger' : passwordsMatch ? 'border-success' : ''}
            />
          {shown('confirmPassword') ? (
            <FieldMessage id="confirm-msg">{shown('confirmPassword')}</FieldMessage>
          ) : passwordsMatch ? (
            <span id="confirm-msg" className="mt-1.5 flex items-center gap-1 text-xs font-medium text-success">
              <IconCheck size={14} /> Passwords match
            </span>
          ) : null}
        </label>

        <p data-auth-item="" className="rounded-lg border border-line bg-panel-2 px-3 py-2 text-xs text-muted">
          Fico is a personal record-keeping tool — it isn't connected to GCash, your bank, or any other
          financial institution. Nothing here reflects your real, live balance, and small mismatches between
          what's recorded here and your actual accounts are expected, not a bug.
        </p>

        <div data-auth-item="">
          <label className="flex items-start gap-2 text-sm text-muted">
            <input
              id="terms"
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 accent-[var(--brand)]"
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
          {submitted && !termsAccepted && <FieldMessage id="terms-msg">{errors.termsAccepted}</FieldMessage>}
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <button data-auth-item="" type="submit" disabled={loading || googleBusy} className="btn btn-primary w-full py-2.5">
          {loading ? 'Creating your account…' : 'Create account'}
        </button>
      </form>

      <div data-auth-item="">
        <GoogleButton
          mode="signup"
          // A new Google account needs the invite code typed above too.
          inviteCode={inviteCode.trim() || undefined}
          // An existing Google-linked account with 2FA on: finish on the sign-in screen's code step.
          onTwoFactor={(pendingToken) => navigate('/login', { state: { pendingToken } })}
          onError={setError}
          onBusyChange={setGoogleBusy}
        />
      </div>

      <p data-auth-item="" className="text-center text-sm text-muted">
        Already have an account?{' '}
        <AuthLink to="/login" className="font-semibold text-brand hover:underline">
          Sign in
        </AuthLink>
      </p>
    </div>
  )
}

export default Register
