import { useMemo, useState } from 'react'
import { useMoney } from '../../hooks/useMoney'
import type { CategoryKind } from '../../types/models'

const NEW_CATEGORY_VALUE = '__new__'

/**
 * A dropdown of the space's categories for the given kind, plus "no
 * category" and — since picking "Other" for lack of anything closer was
 * the actual complaint — "+ Add new category" right there, instead of
 * needing the Categories page. The new category is created for real (this
 * app's categories are a managed list, never free text) and selected
 * immediately once added.
 */
const CategoryPicker = ({
  kind,
  value,
  onChange,
  className = 'select w-auto',
}: {
  kind: CategoryKind
  value: string
  onChange: (categoryId: string) => void
  className?: string
}) => {
  const { categories, addCategory, canEdit } = useMoney()
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const options = useMemo(
    () =>
      categories
        .filter((c) => c.kind === kind && !c.archived)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [categories, kind],
  )

  const handleSelect = (id: string) => {
    if (id === NEW_CATEGORY_VALUE) {
      setError('')
      setCreating(true)
      return
    }
    onChange(id)
  }

  const confirmNew = async () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    setError('')
    setBusy(true)
    try {
      const created = await addCategory({ name: trimmed, kind })
      onChange(created.id)
      setCreating(false)
      setNewName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add category')
    } finally {
      setBusy(false)
    }
  }

  if (creating) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void confirmNew()
            }
          }}
          placeholder="New category name"
          autoFocus
          className="input w-36"
        />
        <button
          type="button"
          onClick={() => void confirmNew()}
          disabled={busy || !newName.trim()}
          className="text-xs text-brand underline disabled:opacity-50"
        >
          {busy ? 'Adding…' : 'Add'}
        </button>
        <button
          type="button"
          onClick={() => {
            setCreating(false)
            setNewName('')
            setError('')
          }}
          className="text-xs text-muted underline"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-danger">{error}</span>}
      </span>
    )
  }

  return (
    <select
      value={value}
      onChange={(e) => handleSelect(e.target.value)}
      className={className}
      aria-label="Category"
    >
      <option value="">No category</option>
      {options.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
      {canEdit && <option value={NEW_CATEGORY_VALUE}>+ Add new category</option>}
    </select>
  )
}

export default CategoryPicker
