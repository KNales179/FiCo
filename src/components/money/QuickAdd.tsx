import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMoney } from '../../hooks/useMoney'
import { useMutationContext } from '../../hooks/useMutationContext'
import {
  currencySymbol,
  formatMoney,
  minorPerMajor,
  minorToDecimalString,
  parseAmountToMinor,
} from '../../domain/money'
import { fetchExchangeRate } from '../../features/currency/exchangeRate'
import { recordItemizedExpense } from '../../features/receipts'
import { Button } from '../ui'
import { IconRotateCcw } from '../icons'
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

  const today = () => new Date().toISOString().slice(0, 10)

  const [direction, setDirection] = useState<'EXPENSE' | 'INCOME' | 'TRANSFER'>(
    'EXPENSE',
  )
  const [amount, setAmount] = useState('')
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [chosenAccountId, setChosenAccountId] = useState('')
  const [destinationAccountId, setDestinationAccountId] = useState('')
  // Defaults to today — only needs changing when the recording happens
  // later than the actual spend/income (Roadmap feedback).
  const [date, setDate] = useState(today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [items, setItems] = useState<DraftItem[]>([])

  // The chosen account, falling back to the space default, then the first.
  const accountId =
    chosenAccountId || defaultAccount?.id || activeAccounts[0]?.id || ''
  // The other side of a transfer — falls back to whatever active account
  // isn't the source, so the picker never starts pointed at itself.
  const toAccountId =
    destinationAccountId ||
    activeAccounts.find((a) => a.id !== accountId)?.id ||
    ''

  const fromAccount = activeAccounts.find((a) => a.id === accountId)
  const toAccount = activeAccounts.find((a) => a.id === toAccountId)
  const crossCurrency =
    direction === 'TRANSFER' &&
    !!fromAccount &&
    !!toAccount &&
    fromAccount.currency !== toAccount.currency

  // The converted amount for a cross-currency transfer — auto-filled from a
  // live rate lookup, but always editable by hand, since the rate the app
  // finds might not match whatever rate actually applied to the real
  // transfer (a bank or remittance service's own rate, say).
  const [destinationAmount, setDestinationAmount] = useState('')
  const [destinationTouched, setDestinationTouched] = useState(false)
  const [rate, setRate] = useState<{ value: number; fromCache: boolean } | null>(
    null,
  )
  const [rateLoading, setRateLoading] = useState(false)
  const [rateError, setRateError] = useState('')
  const [rateNonce, setRateNonce] = useState(0)

  const fromCurrency = fromAccount?.currency
  const toCurrency = toAccount?.currency

  useEffect(() => {
    // Resets the "did the person edit this by hand" flag whenever the pair
    // itself changes, so a manual override from a previous pair doesn't
    // linger onto a new one.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDestinationTouched(false)
  }, [fromCurrency, toCurrency])

  useEffect(() => {
    if (!crossCurrency || !fromCurrency || !toCurrency) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRate(null)
      setRateError('')
      return
    }
    let cancelled = false
    setRateLoading(true)
    setRateError('')
    fetchExchangeRate(fromCurrency, toCurrency)
      .then((r) => {
        if (cancelled) return
        setRate({ value: r.rate, fromCache: r.fromCache })
      })
      .catch((err) => {
        if (cancelled) return
        setRate(null)
        setRateError(
          err instanceof Error ? err.message : 'Could not get a rate',
        )
      })
      .finally(() => {
        if (!cancelled) setRateLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [crossCurrency, fromCurrency, toCurrency, rateNonce])

  useEffect(() => {
    if (!crossCurrency || !rate || destinationTouched || !fromCurrency || !toCurrency) {
      return
    }
    const amountMinor = parseAmountToMinor(amount, fromCurrency)
    if (amountMinor === null || amountMinor <= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDestinationAmount('')
      return
    }
    const sourceMajor = amountMinor / minorPerMajor(fromCurrency)
    const destMinor = Math.round(sourceMajor * rate.value * minorPerMajor(toCurrency))
    setDestinationAmount(minorToDecimalString(destMinor, toCurrency))
  }, [amount, rate, crossCurrency, destinationTouched, fromCurrency, toCurrency])

  if (!canEdit || activeAccounts.length === 0) return null

  const batchMode =
    direction === 'EXPENSE' &&
    categories.find((c) => c.id === categoryId)?.tracksItems === true

  const computedTotalMinor = sumItemPricesMinor(items)
  const occurredAt = new Date(`${date}T00:00:00.000Z`).toISOString()

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
        await recordItemizedExpense(ctx, {
          accountId,
          title,
          occurredAt,
          amountMinor,
          categoryId: categoryId || null,
          categoryName: categoryNameById.get(categoryId) ?? null,
          items: toScannedReceiptItems(items, categoryNameById),
        })
        await refresh()
        setTitle('')
        setCategoryId('')
        setItems([])
        setDate(today())
        setSaved(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save')
      } finally {
        setBusy(false)
      }
      return
    }

    const amountMinor = parseAmountToMinor(amount, fromAccount?.currency)
    if (amountMinor === null || amountMinor <= 0) {
      setError('Enter an amount greater than zero')
      return
    }

    if (direction === 'TRANSFER' && toAccountId === accountId) {
      setError('Pick two different accounts')
      return
    }

    let destinationAmountMinor: number | null = null
    if (direction === 'TRANSFER' && crossCurrency && toAccount) {
      destinationAmountMinor = parseAmountToMinor(
        destinationAmount,
        toAccount.currency,
      )
      if (destinationAmountMinor === null || destinationAmountMinor <= 0) {
        setError('Enter how much this is worth in the destination currency')
        return
      }
    }

    setBusy(true)
    try {
      await addTransaction({
        type: direction,
        amountMinor,
        title: title.trim() || 'Transfer',
        accountId,
        categoryId: direction === 'TRANSFER' ? null : categoryId || null,
        destinationAccountId: direction === 'TRANSFER' ? toAccountId : undefined,
        destinationAmountMinor:
          direction === 'TRANSFER' ? destinationAmountMinor : undefined,
        exchangeRate:
          direction === 'TRANSFER' && crossCurrency ? rate?.value ?? null : undefined,
        occurredAt,
      })
      setAmount('')
      setTitle('')
      setCategoryId('')
      setDestinationAccountId('')
      setDestinationAmount('')
      setDestinationTouched(false)
      setDate(today())
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
          {(['EXPENSE', 'INCOME', 'TRANSFER'] as const).map((d) => (
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
              {d === 'EXPENSE' ? 'Spent' : d === 'INCOME' ? 'Received' : 'Transfer'}
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
              batchMode
                ? 'Where? (e.g. the store)'
                : direction === 'EXPENSE'
                  ? 'What for?'
                  : direction === 'INCOME'
                    ? 'From?'
                    : 'Note (optional)'
            }
            required={direction !== 'TRANSFER'}
            maxLength={120}
            className="input min-w-[8rem] flex-1"
          />
          <select
            value={accountId}
            onChange={(e) => setChosenAccountId(e.target.value)}
            className="select w-auto"
            title={direction === 'TRANSFER' ? 'From' : undefined}
          >
            {activeAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.isDefault ? ' •' : ''}
              </option>
            ))}
          </select>
          {direction === 'TRANSFER' && (
            <>
              <span className="text-sm text-muted">to</span>
              <select
                value={toAccountId}
                onChange={(e) => setDestinationAccountId(e.target.value)}
                className="select w-auto"
              >
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </>
          )}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={today()}
            title="When this actually happened — defaults to today, change it if you're recording late"
            className="input w-auto"
          />
          {direction !== 'TRANSFER' && (
            <CategoryPicker
              kind={direction === 'INCOME' ? 'INCOME' : 'EXPENSE'}
              value={categoryId}
              onChange={changeCategory}
            />
          )}
          {!batchMode && !crossCurrency && (
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? 'Saving…' : 'Add'}
            </Button>
          )}
        </div>

        {crossCurrency && toAccount && fromAccount && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-panel-2 p-2 text-sm">
            <span className="text-muted">
              {rateLoading
                ? 'Getting today’s rate…'
                : rate
                  ? `1 ${fromAccount.currency} ≈ ${rate.value.toFixed(4)} ${toAccount.currency}${rate.fromCache ? ' (last known)' : ''}`
                  : rateError || 'Rate unavailable — enter the converted amount by hand'}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              iconOnly
              aria-label="Refresh rate"
              title="Refresh rate"
              disabled={rateLoading}
              onClick={() => setRateNonce((n) => n + 1)}
            >
              <IconRotateCcw size={14} />
            </Button>
            <span className="ml-auto inline-flex items-center gap-1">
              <span className="text-muted">Lands as</span>
              <span className="text-muted">{currencySymbol(toAccount.currency)}</span>
              <input
                value={destinationAmount}
                onChange={(e) => {
                  setDestinationAmount(e.target.value)
                  setDestinationTouched(true)
                }}
                inputMode="decimal"
                placeholder="Converted amount"
                className="input w-32"
              />
            </span>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? 'Saving…' : 'Add'}
            </Button>
          </div>
        )}

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
                  {formatMoney(computedTotalMinor, fromAccount?.currency)}
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
