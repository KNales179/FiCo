import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useShopping } from '../hooks/useShopping'
import { useMoney } from '../hooks/useMoney'
import { useAuth } from '../hooks/useAuth'
import { useSpace } from '../hooks/useSpace'
import { computeListTotals } from '../features/shopping'
import { suggestForName, type ItemSuggestion } from '../features/items'
import { getLastSeenAt, isUnseen, markSeenNow } from '../features/seen'
import { formatMoney, parseAmountToMinor } from '../domain/money'
import { PageHeader, Button, Input, Select, Alert, SkeletonCard } from '../components/ui'
import { IconCheck, IconPlus, IconTrash, IconX } from '../components/icons'
import CategoryPicker from '../components/money/CategoryPicker'
import type { ShoppingItem } from '../types/models'

const SEEN_AREA = 'shopping'

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
    <Input
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
      className="w-20 px-2 py-1 text-sm"
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
            className="select w-auto text-xs"
          />
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            aria-label="Remove item"
            title="Remove item"
            className="hover:text-danger"
            onClick={() => void removeItem(item.id)}
          >
            <IconTrash size={14} />
          </Button>
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
  const { user } = useAuth()
  const { activeSpaceId } = useSpace()
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null)
  const [openedListIds, setOpenedListIds] = useState<Set<string>>(new Set())
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

  // Debounced (Product Spec: frontend-data-performance) so the "last
  // time" lookup doesn't fire on every single keystroke while typing an
  // item name — and the timestamp guards against an out-of-order reply
  // (a slower lookup for what was typed a moment ago) landing after a
  // newer one and overwriting the right suggestion with a stale one.
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suggestRequestedAt = useRef(0)

  const onItemNameChange = (value: string) => {
    setItemName(value)
    if (suggestTimer.current) clearTimeout(suggestTimer.current)

    if (!activeSpaceId || value.trim().length < 2) {
      setSuggestion(null)
      return
    }

    suggestTimer.current = setTimeout(() => {
      const requestedAt = Date.now()
      suggestRequestedAt.current = requestedAt
      void suggestForName(activeSpaceId, value).then((s) => {
        if (suggestRequestedAt.current === requestedAt) setSuggestion(s)
      })
    }, 200)
  }

  // "Seen" cursor for this section (Roadmap feedback: a list someone else
  // created stays highlighted until you open it, or leave the page).
  useEffect(() => {
    if (!activeSpaceId) return
    void getLastSeenAt(SEEN_AREA, activeSpaceId).then(setLastSeenAt)
    return () => {
      void markSeenNow(SEEN_AREA, activeSpaceId)
    }
  }, [activeSpaceId])

  const openList = (id: string) => {
    selectList(id)
    setOpenedListIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
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
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <SkeletonCard lines={1} />
        <SkeletonCard lines={4} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Shopping" />

      {error && <Alert>{error}</Alert>}

      {canEdit && (
        <form
          onSubmit={submitNewList}
          className="flex flex-wrap items-center gap-2 card"
        >
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New list (e.g. Weekend grocery)"
            required
            maxLength={120}
            className="min-w-[10rem] flex-1"
          />
          <Input
            value={newBudget}
            onChange={(e) => setNewBudget(e.target.value)}
            inputMode="decimal"
            placeholder="Budget (optional)"
            className="w-32"
          />
          <label className="flex items-center gap-1.5 text-sm text-muted">
            <input
              type="checkbox"
              checked={newPrivate}
              onChange={(e) => setNewPrivate(e.target.checked)}
            />
            Private
          </label>
          <Button type="submit" variant="primary">
            <IconPlus size={15} />
            Create list
          </Button>
        </form>
      )}

      {lists.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {lists.map((list) => {
            const unseen =
              !openedListIds.has(list.id) &&
              isUnseen(list.createdAt, list.createdBy, lastSeenAt, user?.id)
            const selected = list.id === selectedList?.id
            return (
              <button
                key={list.id}
                type="button"
                onClick={() => openList(list.id)}
                className={`relative rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  selected
                    ? 'border-transparent bg-brand text-brand-ink'
                    : 'border-line bg-panel text-ink hover:bg-panel-2'
                } ${unseen ? 'ring-2 ring-danger/60' : ''}`}
              >
                {unseen && (
                  <span
                    aria-label="New, not yet seen"
                    className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-danger"
                  />
                )}
                {list.title}
                {list.status !== 'ACTIVE' &&
                  ` (${list.status.toLowerCase()})`}
              </button>
            )
          })}
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
                  className="font-medium text-brand underline"
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
                <Input
                  value={itemName}
                  onChange={(e) => void onItemNameChange(e.target.value)}
                  placeholder="Add item"
                  required
                  maxLength={120}
                  className="min-w-[8rem] flex-1"
                />
                <Input
                  value={itemPrice}
                  onChange={(e) => setItemPrice(e.target.value)}
                  inputMode="decimal"
                  placeholder={
                    suggestion?.lastPriceMinor != null
                      ? `${suggestion.lastPriceMinor / 100}`
                      : 'Planned price'
                  }
                  className="w-28"
                />
                <Button type="submit" variant="primary">
                  <IconPlus size={15} />
                  Add
                </Button>
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
                  className="select w-auto"
                />
                <span className="text-muted">Pay from</span>
                <Select
                  value={payAccountId || defaultAccount?.id || ''}
                  onChange={(e) => setPayAccountId(e.target.value)}
                  className="w-auto"
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
                </Select>
                <Button
                  variant="primary"
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
                >
                  <IconCheck size={15} />
                  Complete shopping
                </Button>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => void cancelList(selectedList.id)}>
                  <IconX size={14} />
                  Cancel list
                </Button>
                <Button variant="danger" onClick={() => void deleteList(selectedList.id)}>
                  <IconTrash size={14} />
                  Delete
                </Button>
              </div>
            </div>
          )}

          {canEdit && !listIsActive && (
            <div className="mt-4">
              <Button
                variant="danger"
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
              >
                <IconTrash size={14} />
                Delete list
              </Button>
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
