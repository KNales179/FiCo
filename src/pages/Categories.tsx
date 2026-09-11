import { useMemo, useState, type FormEvent } from 'react'
import { useMoney } from '../hooks/useMoney'
import type { CategoryKind } from '../types/models'

const Categories = () => {
  const { categories, canEdit, addCategory, editCategory, removeCategory } =
    useMoney()

  const [name, setName] = useState('')
  const [kind, setKind] = useState<CategoryKind>('EXPENSE')
  const [tracksItems, setTracksItems] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [error, setError] = useState('')

  const grouped = useMemo(() => {
    const visible = categories.filter(
      (c) => showArchived || !c.archived,
    )
    return {
      EXPENSE: visible
        .filter((c) => c.kind === 'EXPENSE')
        .sort((a, b) => a.name.localeCompare(b.name)),
      INCOME: visible
        .filter((c) => c.kind === 'INCOME')
        .sort((a, b) => a.name.localeCompare(b.name)),
    }
  }, [categories, showArchived])

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    try {
      await addCategory({ name, kind, tracksItems })
      setName('')
      setTracksItems(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add category')
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
      <p className="text-sm text-muted">
        Renaming or removing a category never changes transactions already
        recorded — they keep the name they were saved with. A category marked{' '}
        <strong>tracks items</strong> switches Quick Add to an itemized list
        instead of one amount — useful for a grocery run or any batch
        purchase.
      </p>

      {(['EXPENSE', 'INCOME'] as CategoryKind[]).map((k) => (
        <section key={k} className="card">
          <h2 className="text-sm font-semibold">
            {k === 'EXPENSE' ? 'Expenses' : 'Income'}
          </h2>
          <ul className="mt-2 divide-y">
            {grouped[k].map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between py-1.5 text-sm"
              >
                <span className={c.archived ? 'text-muted' : ''}>
                  {c.name}
                  {c.archived && ' (archived)'}
                  {c.tracksItems && (
                    <span className="chip ml-2">tracks items</span>
                  )}
                </span>
                {canEdit && (
                  <span className="flex gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        void editCategory(c.id, {
                          tracksItems: !c.tracksItems,
                        })
                      }
                      className="text-muted underline"
                    >
                      {c.tracksItems ? 'stop tracking items' : 'track items'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = window.prompt('Rename category', c.name)
                        if (next && next.trim()) {
                          void editCategory(c.id, { name: next.trim() })
                        }
                      }}
                      className="text-muted underline"
                    >
                      rename
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void editCategory(c.id, { archived: !c.archived })
                      }
                      className="text-muted underline"
                    >
                      {c.archived ? 'unarchive' : 'archive'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeCategory(c.id)}
                      className="text-muted underline"
                    >
                      delete
                    </button>
                  </span>
                )}
              </li>
            ))}
            {grouped[k].length === 0 && (
              <li className="py-1.5 text-sm text-muted">None.</li>
            )}
          </ul>
        </section>
      ))}

      <label className="flex items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
        show archived
      </label>

      {canEdit && (
        <form
          onSubmit={submit}
          className="flex flex-wrap items-center gap-2 card"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New category"
            required
            maxLength={40}
            className="min-w-[10rem] flex-1 border px-2 py-1 text-sm"
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as CategoryKind)}
            className="border px-2 py-1 text-sm"
          >
            <option value="EXPENSE">expense</option>
            <option value="INCOME">income</option>
          </select>
          {kind === 'EXPENSE' && (
            <label className="flex items-center gap-1.5 text-xs text-muted">
              <input
                type="checkbox"
                checked={tracksItems}
                onChange={(e) => setTracksItems(e.target.checked)}
              />
              tracks items
            </label>
          )}
          <button type="submit" className="border px-3 py-1 text-sm">
            Add
          </button>
          {error && (
            <span className="text-xs text-danger">{error}</span>
          )}
        </form>
      )}
    </div>
  )
}

export default Categories
