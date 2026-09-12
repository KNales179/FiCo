import { useMemo, useState, type FormEvent } from 'react'
import { useShopping } from '../hooks/useShopping'
import { useMoney } from '../hooks/useMoney'
import { useSpace } from '../hooks/useSpace'
import { computeListTotals } from '../features/shopping'
import { suggestForName, type ItemSuggestion } from '../features/items'
import { formatMoney, parseAmountToMinor } from '../domain/money'
import CategoryPicker from '../components/money/CategoryPicker'
import type { ShoppingItem } from '../types/models'

const PriceField = ({
  value,
  placeholder,
  onCommit,
}: {
  value: number | null | undefined
  placeholder: string
  onCommit: (minor: number | null) => void
}) => {
  const [text, setText] = useState(
    value != null ? String(value / 100) : '',
  )
  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const trimmed = text.trim()
        if (trimmed === '') return onCommit(null)
        const minor = parseAmountToMinor(trimmed)
        if (minor != null) onCommit(minor)
      }}
      inputMode="decimal"
      placeholder={placeholder}
      className="w-20 border px-1 py-0.5 text-sm"
    />
  )
}

const ItemRow = ({ item }: { item: ShoppingItem }) => {
  const {
    canEdit,
    toggleItem,
    setPlannedPrice,
    setActualPrice,
    removeItem,
    setItemCategory,
  } = useShopping()

  return (
    <li className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
      <input
        type="checkbox"
        checked={item.checked}
        disabled={!canEdit}
        onChange={(e) => void toggleItem(item.id, e.target.checked)}
      />
      <span
        className={`min-w-[6rem] flex-1 ${
          item.checked ? 'line-through text-gray-400' : ''
        }`}
      >
        {item.name}
        {item.addedDuringTrip && (
          <span className="ml-1 text-xs text-amber-600">added</span>
        )}
      </span>

      {canEdit ? (
        <>
          <PriceField
            value={item.plannedPriceMinor}
            placeholder="planned"
            onCommit={(m) => void setPlannedPrice(item.id, m)}
          />
          <PriceField
            value={item.actualPriceMinor}
            placeholder="actual"
            onCommit={(m) => void setActualPrice(item.id, m)}
          />
          <CategoryPicker
            kind="EXPENSE"
            value=""
            onChange={(id) =>
              void setItemCategory(item.name, id || null)
            }
            className="border px-1 py-0.5 text-xs"
          />
          <button
            type="button"
            onClick={() => void removeItem(item.id)}
            className="text-xs text-muted underline"
          >
            remove
          </button>
        </>
      ) : (
        <span>
          {formatMoney(
            item.actualPriceMinor ?? item.plannedPriceMinor ?? 0,
          )}
        </span>
      )}
    </li>
  )
}

const Shopping = () => {
  const {
    lists,
    selectedList,
    items,
    loading,
    error,
    canEdit,
    selectList,
    createList,
    addItem,
    completeList,
    cancelList,
    deleteList,
    updateList,
  } = useShopping()

  const { accounts, defaultAccount, categories } = useMoney()
  const { activeSpaceId } = useSpace()
  const activeAccounts = useMemo(
    () => accounts.filter((a) => a.status === 'ACTIVE'),
    [accounts],
  )
  const categoryNameById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  )

  const [newTitle, setNewTitle] = useState('')
  const [newBudget, setNewBudget] = useState('')
  const [newPrivate, setNewPrivate] = useState(false)
  const [itemName, setItemName] = useState('')
  const [itemPrice, setItemPrice] = useState('')
  const [suggestion, setSuggestion] = useState<ItemSuggestion | null>(null)
  const [formError, setFormError] = useState('')
  const [payAccountId, setPayAccountId] = useState('')
  // The trip's own category ("Groceries" vs "Shopping", say) — a
  // conscious choice at checkout time, instead of guessing one from
  // whatever the individual items happen to share (owner feedback).
  const [payCategoryId, setPayCategoryId] = useState('')
  const [completion, setCompletion] = useState<string | null>(null)

  const onItemNameChange = async (value: string) => {
    setItemName(value)
    if (!activeSpaceId || value.trim().length < 2) {
      setSuggestion(null)
      return
    }
    const s = await suggestForName(activeSpaceId, value)
    setSuggestion(s)
  }

  const totals = useMemo(
    () =>
      selectedList
        ? computeListTotals(selectedList, items)
        : null,
    [selectedList, items],
  )

  const listIsActive = selectedList?.status === 'ACTIVE'

  const submitNewList = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError('')
    const budget =
      newBudget.trim() === '' ? null : parseAmountToMinor(newBudget)
    if (budget === undefined) return
    try {
      await createList({
        title: newTitle,
        plannedBudgetMinor: budget,
        visibility: newPrivate ? 'PRIVATE' : 'SPACE',
      })
      setNewTitle('')
      setNewBudget('')
      setNewPrivate(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create list')
    }
  }

  const submitItem = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError('')
    const planned =
      itemPrice.trim() === '' ? null : parseAmountToMinor(itemPrice)
    try {
      await addItem({
        name: itemName,
        plannedPriceMinor:
          planned ?? suggestion?.lastPriceMinor ?? null,
        addedDuringTrip: (totals?.checkedCount ?? 0) > 0,
      })
      setItemName('')
      setItemPrice('')
      setSuggestion(null)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add item')
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading…</p>
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Shopping</h1>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {canEdit && (
        <form
          onSubmit={submitNewList}
          className="flex flex-wrap items-center gap-2 card"
        >
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New list (e.g. Weekend grocery)"
            required
            maxLength={120}
            className="min-w-[10rem] flex-1 border px-2 py-1 text-sm"
          />
          <input
            value={newBudget}
            onChange={(e) => setNewBudget(e.target.value)}
            inputMode="decimal"
            placeholder="Budget (optional)"
            className="w-32 border px-2 py-1 text-sm"
          />
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={newPrivate}
              onChange={(e) => setNewPrivate(e.target.checked)}
            />
            private
          </label>
          <button type="submit" className="border px-3 py-1 text-sm">
            Create
          </button>
        </form>
      )}

      {lists.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {lists.map((list) => (
            <button
              key={list.id}
              type="button"
              onClick={() => selectList(list.id)}
              className={`border px-2 py-1 text-sm ${
                list.id === selectedList?.id ? 'bg-brand text-brand-ink' : ''
              }`}
            >
              {list.title}
              {list.status !== 'ACTIVE' &&
                ` (${list.status.toLowerCase()})`}
            </button>
          ))}
        </div>
      )}

      {selectedList && totals && (
        <section className="card">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {selectedList.title}
              {selectedList.visibility === 'PRIVATE' && (
                <span className="ml-2 text-xs text-amber-600">private</span>
              )}
            </h2>
            <span className="flex items-center gap-2 text-xs text-muted">
              {totals.checkedCount}/{totals.itemCount} checked
              {canEdit && listIsActive && (
                <button
                  type="button"
                  onClick={() =>
                    void updateList(selectedList.id, {
                      visibility:
                        selectedList.visibility === 'PRIVATE'
                          ? 'SPACE'
                          : 'PRIVATE',
                    })
                  }
                  className="underline"
                >
                  {selectedList.visibility === 'PRIVATE'
                    ? 'share'
                    : 'make private'}
                </button>
              )}
            </span>
          </div>

          <ul className="mt-3 divide-y">
            {items.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </ul>

          {canEdit && listIsActive && (
            <form
              onSubmit={submitItem}
              className="mt-3 border-t pt-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={itemName}
                  onChange={(e) => void onItemNameChange(e.target.value)}
                  placeholder="Add item"
                  required
                  maxLength={120}
                  className="min-w-[8rem] flex-1 border px-2 py-1 text-sm"
                />
                <input
                  value={itemPrice}
                  onChange={(e) => setItemPrice(e.target.value)}
                  inputMode="decimal"
                  placeholder={
                    suggestion?.lastPriceMinor != null
                      ? `${suggestion.lastPriceMinor / 100}`
                      : 'Planned price'
                  }
                  className="w-28 border px-2 py-1 text-sm"
                />
                <button type="submit" className="border px-3 py-1 text-sm">
                  Add
                </button>
              </div>
              {suggestion && (
                <p className="mt-1 text-xs text-muted">
                  {suggestion.lastPriceMinor != null &&
                    `Last time: ${formatMoney(suggestion.lastPriceMinor)}`}
                  {suggestion.category && ` · ${suggestion.category}`}
                </p>
              )}
            </form>
          )}

          <dl className="mt-4 space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Projected total</dt>
              <dd>{formatMoney(totals.projectedTotalMinor)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Spent so far</dt>
              <dd>{formatMoney(totals.spentMinor)}</dd>
            </div>
            {totals.remainingBudgetMinor != null && (
              <div className="flex justify-between font-medium">
                <dt>Remaining of budget</dt>
                <dd
                  className={
                    totals.remainingBudgetMinor < 0 ? 'text-danger' : ''
                  }
                >
                  {formatMoney(totals.remainingBudgetMinor)}
                </dd>
              </div>
            )}
          </dl>

          {formError && (
            <p role="alert" className="mt-2 text-xs text-danger">
              {formError}
            </p>
          )}

          {completion && (
            <p className="mt-3 text-sm text-success">{completion}</p>
          )}

          {canEdit && listIsActive && (
            <div className="mt-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted">This trip is</span>
                <CategoryPicker
                  kind="EXPENSE"
                  value={payCategoryId}
                  onChange={setPayCategoryId}
                  className="border px-2 py-1 text-sm"
                />
                <span className="text-muted">Pay from</span>
                <select
                  value={payAccountId || defaultAccount?.id || ''}
                  onChange={(e) => setPayAccountId(e.target.value)}
                  className="border px-2 py-1"
                >
                  {activeAccounts.length === 0 && (
                    <option value="">No accounts</option>
                  )}
                  {activeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.isDefault ? ' •' : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={activeAccounts.length === 0}
                  onClick={async () => {
                    setFormError('')
                    setCompletion(null)
                    try {
                      const r = await completeList(
                        selectedList.id,
                        payAccountId || defaultAccount?.id,
                        {
                          categoryId: payCategoryId || null,
                          categoryName: categoryNameById.get(payCategoryId) ?? null,
                        },
                      )
                      setCompletion(
                        r.createdCount === 0
                          ? 'Shopping done — nothing new to record.'
                          : `Shopping done — ${formatMoney(r.spentMinor)} recorded across ${r.itemCount} item${r.itemCount === 1 ? '' : 's'}.`,
                      )
                      setPayCategoryId('')
                    } catch (err) {
                      setFormError(
                        err instanceof Error
                          ? err.message
                          : 'Could not complete',
                      )
                    }
                  }}
                  className="border px-3 py-1 disabled:opacity-50"
                >
                  Complete shopping
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void cancelList(selectedList.id)}
                  className="border px-3 py-1 text-sm text-muted"
                >
                  Cancel list
                </button>
                <button
                  type="button"
                  onClick={() => void deleteList(selectedList.id)}
                  className="border px-3 py-1 text-sm text-muted"
                >
                  Delete
                </button>
              </div>
            </div>
          )}

          {canEdit && !listIsActive && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      selectedList.status === 'COMPLETED'
                        ? `Delete "${selectedList.title}"? This removes the list and its items only — the expense it recorded stays in your transactions untouched.`
                        : `Delete "${selectedList.title}"?`,
                    )
                  )
                    void deleteList(selectedList.id)
                }}
                className="border px-3 py-1 text-sm text-muted"
              >
                Delete list
              </button>
            </div>
          )}
        </section>
      )}

      {lists.length === 0 && (
        <p className="text-sm text-muted">
          No shopping lists yet.
        </p>
      )}
    </div>
  )
}

export default Shopping
