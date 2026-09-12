import { useMemo, useState, type FormEvent } from 'react'
import { useMoney } from '../hooks/useMoney'
import { PageHeader, Button, Input, Select } from '../components/ui'
import {
  IconArchive,
  IconEdit,
  IconPlus,
  IconRotateCcw,
  IconTag,
  IconTrash,
} from '../components/icons'
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
      <PageHeader title="Categories" />
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
                  <span className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      aria-label={c.tracksItems ? 'Stop tracking items' : 'Track items'}
                      title={c.tracksItems ? 'Stop tracking items' : 'Track items'}
                      className={c.tracksItems ? 'text-brand' : undefined}
                      onClick={() =>
                        void editCategory(c.id, {
                          tracksItems: !c.tracksItems,
                        })
                      }
                    >
                      <IconTag size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      aria-label="Rename"
                      title="Rename"
                      onClick={() => {
                        const next = window.prompt('Rename category', c.name)
                        if (next && next.trim()) {
                          void editCategory(c.id, { name: next.trim() })
                        }
                      }}
                    >
                      <IconEdit size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      aria-label={c.archived ? 'Unarchive' : 'Archive'}
                      title={c.archived ? 'Unarchive' : 'Archive'}
                      onClick={() =>
                        void editCategory(c.id, { archived: !c.archived })
                      }
                    >
                      {c.archived ? <IconRotateCcw size={14} /> : <IconArchive size={14} />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      aria-label="Delete"
                      title="Delete"
                      className="hover:text-danger"
                      onClick={() => void removeCategory(c.id)}
                    >
                      <IconTrash size={14} />
                    </Button>
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
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New category"
            required
            maxLength={40}
            className="min-w-[10rem] flex-1"
          />
          <Select
            value={kind}
            onChange={(e) => setKind(e.target.value as CategoryKind)}
            className="w-auto"
          >
            <option value="EXPENSE">expense</option>
            <option value="INCOME">income</option>
          </Select>
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
          <Button type="submit" variant="primary">
            <IconPlus size={15} />
            Add
          </Button>
          {error && (
            <span className="text-xs text-danger">{error}</span>
          )}
        </form>
      )}
    </div>
  )
}

export default Categories
