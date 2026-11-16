import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { deleteMe } from '../../services/authService'
import { ApiError, isNetworkError } from '../../lib/api'
import { isDemoMode } from '../../features/demo/demoMode'
import { shakeById } from '../../lib/feedback'
import { Button, Card } from '../ui'
import PasswordInput from '../auth/PasswordInput'
import { IconTrash } from '../icons'

/**
 * Account → Delete my account. Erases the login, the profile and the
 * personal Finance; records added to other people's shared Finances stay
 * there. A shared Finance you own that others still use has to be handed
 * over first (the server checks and says which). Password + typing DELETE,
 * so it can't happen by accident.
 */
const DeleteAccountCard = () => {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const demo = isDemoMode()
  const ready = password.length > 0 && typed.trim().toUpperCase() === 'DELETE'

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!ready) return
    setBusy(true)
    setError('')
    try {
      await deleteMe(password)
      await logout().catch(() => undefined)
      navigate('/', { replace: true })
    } catch (err) {
      if (isNetworkError(err)) setError('You need to be online to delete your account.')
      else if (err instanceof ApiError && err.status === 401) {
        setError('That’s not your password. Signed up with Google? Set one first with “Forgot password” on the sign-in screen.')
        shakeById('delete-password')
      } else setError(err instanceof Error ? err.message : 'Could not delete your account')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-danger/30">
      <h2 className="section-title flex items-center gap-2 text-danger">
        <IconTrash size={16} /> Delete my account
      </h2>
      {!open ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-sm text-muted">
            Permanently erase your account, your profile and your personal Finance. This can’t be undone.
          </p>
          <Button variant="danger" onClick={() => setOpen(true)} disabled={demo} title={demo ? 'Not in the demo' : undefined}>
            Delete my account…
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-3 space-y-3 text-sm">
          <ul className="list-disc space-y-1 pl-5 text-muted">
            <li>
              <span className="font-medium text-ink">Erased:</span> your login, name, email, photo, birthday and paydays,
              two-step sign-in, signed-in devices, notifications, and your personal Finance with all its records and
              receipts.
            </li>
            <li>
              <span className="font-medium text-ink">Kept for others:</span> records you added to someone else’s shared
              Finance stay there for its members, shown as from a deleted account.
            </li>
            <li>
              <span className="font-medium text-ink">Shared Finances you own</span> that others still use must be handed
              over first (Members → Make owner).
            </li>
          </ul>
          <label className="block">
            <span className="field-label">Your password</span>
            <PasswordInput
              id="delete-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <label className="block">
            <span className="field-label">Type DELETE to confirm</span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="input font-mono uppercase"
              autoComplete="off"
              spellCheck={false}
              aria-label="Type DELETE to confirm"
            />
          </label>
          {error && (
            <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-danger">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="danger" disabled={!ready || busy}>
              <IconTrash size={15} />
              {busy ? 'Deleting…' : 'Delete my account forever'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setOpen(false)
                setPassword('')
                setTyped('')
                setError('')
              }}
            >
              Keep my account
            </Button>
          </div>
        </form>
      )}
    </Card>
  )
}

export default DeleteAccountCard
