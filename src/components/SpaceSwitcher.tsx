import { useState, type FormEvent } from 'react'
import { useSpace } from '../hooks/useSpace'

const SpaceSwitcher = () => {
  const {
    spaces,
    activeSpaceId,
    loading,
    fromCache,
    switchSpace,
    createSpace,
  } = useSpace()

  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    setBusy(true)
    setError('')
    try {
      await createSpace(trimmed)
      setName('')
      setCreating(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create space')
    } finally {
      setBusy(false)
    }
  }

  if (loading && spaces.length === 0) {
    return <span className="text-sm text-gray-500">Loading spaces…</span>
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <label htmlFor="space" className="sr-only">
          Active space
        </label>

        <select
          id="space"
          value={activeSpaceId ?? ''}
          onChange={(event) => void switchSpace(event.target.value)}
          className="border px-2 py-1 text-sm"
        >
          {spaces.length === 0 && <option value="">No spaces</option>}
          {spaces.map((space) => (
            <option key={space.id} value={space.id}>
              {space.name}
              {space.type === 'FAMILY' ? ' (family)' : ''}
              {space.role !== 'OWNER' ? ` · ${space.role.toLowerCase()}` : ''}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setCreating((value) => !value)}
          className="border px-2 py-1 text-sm"
        >
          {creating ? 'Cancel' : '+ New'}
        </button>
      </div>

      {fromCache && (
        <span className="text-xs text-amber-600">
          Offline — showing your last known spaces
        </span>
      )}

      {creating && (
        <form onSubmit={handleCreate} className="flex items-center gap-2">
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Family space name"
            maxLength={60}
            className="border px-2 py-1 text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="border px-2 py-1 text-sm disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create'}
          </button>
        </form>
      )}

      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </div>
  )
}

export default SpaceSwitcher
