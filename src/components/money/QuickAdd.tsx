import { useMemo, useState, type FormEvent } from 'react'
import { useMoney } from '../../hooks/useMoney'
import { useMutationContext } from '../../hooks/useMutationContext'
import { formatMoney, parseAmountToMinor } from '../../domain/money'
import { recordScannedReceipt } from '../../features/receipts'
import { Button } from '../ui'
import CategoryPicker from './CategoryPicker'
import ItemRowsEditor from './ItemRowsEditor'
import { newBlankItem, sumItemPricesMinor, toScannedReceiptItems } from './draftItems'
import type { DraftItem } from './draftItems'

/**
 * The fast path for everyday entry (Product Spec §38). Amount + what + pay
 * source, one tap to save. Payment source defaults to the space's default
 * account; category and details stay optional and out of the way.
 *
 * Picking a category marked "tracks items" (Groceries, Shopping by default —
 * Roadmap Phase 26 feedback) switches this to the same itemized row editor
 * scanning a receipt uses, since a grocery run is rarely just one line.
 */
const QuickAdd = () => {
  const { accounts, defaultAccount, categories, canEdit, addTransaction, refresh } =
    useMoney()
  const { ctx } = useMutationContext()

  const activeAccounts = useMemo(
    () => accounts.filter((a) => a.status === 'ACTIVE'),
    [accounts],
  )
  const categoryNameById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  )

  const [direction, setDirection] = useState<'EXPENSE' | 'INCOME'>('EXPENSE')
  const [amount, setAmount] = useState('')
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [chosenAccountId, setChosenAccountId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [items, setItems] = useState<DraftItem[]>([])

  if (!canEdit || activeAccounts.length === 0) return null

  // The chosen account, falling back to the space default, then the first.
  const accountId =
    chosenAccountId || defaultAccount?.id || activeAccounts[0].id

  const batchMode =
    direction === 'EXPENSE' &&
    categories.find((c) => c.id === categoryId)?.tracksItems === true

  const computedTotalMinor = sumItemPricesMinor(items)

  const changeCategory = (nextCategoryId: string) => {
    setCategoryId(nextCategoryId)
    const nextBatch =
      direction === 'EXPENSE' &&
      categories.find((c) => c.id === nextCategoryId)?.tracksItems === true
    if (nextBatch) {
      if (items.length === 0) setItems([newBlankItem([])])
    } else if (items.length > 0) {
      setItems([])
    }
  }

  const updateItem = (id: number, patch: Partial<DraftItem>) =>
    setItems((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const removeItem = (id: number) =>
    setItems((rows) => rows.filter((r) => r.id !== id))

  const addBlankItem = () => setItems((rows) => [...rows, newBlankItem(rows)])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSaved(false)

    if (batchMode) {
      const amountMinor = computedTotalMinor
      if (amountMinor <= 0) {
        setError('Price at least one item')
        return
      }
      if (!title.trim()) {
        setError('Add a short title (e.g. the store)')
        return
      }
      if (!ctx) {
        setError('No active space')
        return
      }

      setBusy(true)
      try {
        await recordScannedReceipt(ctx, {
          accountId,
          title,
          occurredAt: new Date().toISOString(),
          amountMinor,
          items: toScannedReceiptItems(items, categoryNameById),
        })
        await refresh()
        setTitle('')
        setCategoryId('')
        setItems([])
        setSaved(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save')
      } finally {
        setBusy(false)
      }
      return
    }

    const amountMinor = parseAmountToMinor(amount)
    if (amountMinor === null || amountMinor <= 0) {
      setError('Enter an amount greater than zero')
      return
    }

    setBusy(true)
    try {
      await addTransaction({
        type: direction,
        amountMinor,
        title,
        accountId,
        categoryId: categoryId || null,
      })
      setAmount('')
      setTitle('')
      setCategoryId('')
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card">
      <div className="flex items-center justify-between">
        <h2 className="section-title">Quick add</h2>
        <div className="inline-flex overflow-hidden rounded-lg border border-line text-xs font-medium">
          {(['EXPENSE', 'INCOME'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDirection(d)}
              className={`px-3 py-1 transition-colors ${
                direction === d
                  ? 'bg-brand text-brand-ink'
                  : 'bg-panel text-muted hover:bg-panel-2'
              }`}
            >
              {d === 'EXPENSE' ? 'Spent' : 'Received'}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={submit} className="mt-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {!batchMode && (
            <input
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value)
                setSaved(false)
              }}
              inputMode="decimal"
              placeholder="Amount"
              required
              autoFocus
              className="input w-28"
            />
          )}
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setSaved(false)
            }}
            placeholder={
              batchMode ? 'Where? (e.g. the store)' : direction === 'EXPENSE' ? 'What for?' : 'From?'
            }
            required
            maxLength={120}
            className="input min-w-[8rem] flex-1"
          />
          <select
            value={accountId}
            onChange={(e) => setChosenAccountId(e.target.value)}
            className="select w-auto"
          >
            {activeAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.isDefault ? ' •' : ''}
              </option>
            ))}
          </select>
          <CategoryPicker
            kind={direction === 'INCOME' ? 'INCOME' : 'EXPENSE'}
            value={categoryId}
            onChange={changeCategory}
          />
          {!batchMode && (
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? 'Saving…' : 'Add'}
            </Button>
          )}
        </div>

        {batchMode && (
          <>
            <p className="text-xs text-muted">
              {categoryNameById.get(categoryId)} usually means more than one
              thing bought at once — list them below.
            </p>
            <ItemRowsEditor
              items={items}
              onUpdate={updateItem}
              onRemove={removeItem}
              onAdd={addBlankItem}
            />
            <div className="flex items-center justify-between border-t border-line pt-2">
              <span className="text-sm text-muted">
                Total:{' '}
                <span className="font-medium text-ink">
                  {formatMoney(computedTotalMinor)}
                </span>
              </span>
              <Button type="submit" variant="primary" disabled={busy}>
                {busy ? 'Saving…' : 'Add'}
              </Button>
            </div>
          </>
        )}
      </form>

      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="mt-2 text-xs text-success">Saved.</p>
      )}
    </section>
  )
}

export default QuickAdd
