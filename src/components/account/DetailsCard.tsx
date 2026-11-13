import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { updateMe } from '../../services/authService'
import { isNetworkError } from '../../lib/api'
import { Alert, Button, Card } from '../ui'
import { IconCheck, IconUserCircle } from '../icons'

/** Name and username — what other members of your Finances see. */
const DetailsCard = () => {
  const { user, refreshUser } = useAuth()
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [username, setUsername] = useState(user?.username ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const dirty = displayName.trim() !== (user?.displayName ?? '') || username.trim() !== user?.username

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSaved(false)
    setBusy(true)
    try {
      await updateMe({
        displayName: displayName.trim(),
        ...(username.trim() !== user?.username ? { username: username.trim() } : {}),
      })
      await refreshUser()
      setSaved(true)
    } catch (err) {
      setError(
        isNetworkError(err)
          ? 'Saving needs a connection — try again once you’re online.'
          : err instanceof Error
            ? err.message
            : 'Could not save',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <h2 className="flex items-center gap-2 section-title">
        <span className="card-icon">
          <IconUserCircle size={16} />
        </span>
        Your details
      </h2>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <label className="block">
          <span className="field-label">Name</span>
          <input
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value)
              setSaved(false)
            }}
            maxLength={60}
            placeholder="What should Fico call you?"
            autoComplete="name"
            className="input"
          />
          <span className="mt-1 block text-xs text-muted">Shown to members of your Finances.</span>
        </label>
        <label className="block">
          <span className="field-label">Username</span>
          <span className="relative block">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">@</span>
            <input
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                setSaved(false)
              }}
              minLength={3}
              maxLength={30}
              pattern="[A-Za-z0-9_]+"
              title="Letters, numbers and underscores only"
              autoCapitalize="none"
              spellCheck={false}
              required
              className="input pl-7"
            />
          </span>
          <span className="mt-1 block text-xs text-muted">How people in your shared Finances find you. Letters, numbers and underscores.</span>
        </label>
        {error && <Alert>{error}</Alert>}
        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={busy || !dirty}>
            {busy ? 'Saving…' : 'Save details'}
          </Button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-success">
              <IconCheck size={15} /> Saved
            </span>
          )}
        </div>
      </form>
    </Card>
  )
}

export default DetailsCard
