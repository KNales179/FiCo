import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMoney } from '../../hooks/useMoney'
import { useAuth } from '../../hooks/useAuth'
import { useMutationContext } from '../../hooks/useMutationContext'
import { combineDateAndTime, formatMoney, parseAmountToMinor, timeOfDay } from '../../domain/money'
import { listPurchasesForTransaction, type ItemPurchaseDetail } from '../../features/items'
import { listTransactions } from '../../features/money'
import { getLastSeenAt, isUnseen, markSeenNow } from '../../features/seen'
import { onDataChanged } from '../../features/sync/events'
import { loadAppearance } from '../../features/theme'
import { SkeletonRow, Button } from '../ui'
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconArrowRightLeft,
  IconEdit,
  IconEye,
  IconEyeOff,
  IconLock,
  IconSearch,
  IconTrash,
} from '../icons'
import Attachments from '../Attachments'
import CategoryPicker from './CategoryPicker'
import type { Transaction } from '../../types/models'

const SEEN_AREA = 'transactions'

/** A small colored badge for the transaction's direction — the one place
 * this list leans on color beyond the amount itself, so the type reads at
 * a glance even before the amount's sign registers. */
const TypeBadge = ({ type }: { type: Transaction['type'] }) => {
  const style =
    type === 'INCOME'
      ? 'bg-success/10 text-success'
      : type === 'EXPENSE'
        ? 'bg-danger/10 text-danger'
        : 'bg-brand/10 text-brand'
  const ItemIcon =
    type === 'INCOME' ? IconArrowUpRight : type === 'EXPENSE' ? IconArrowDownRight : IconArrowRightLeft
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${style}`}>
      <ItemIcon size={16} />
    </span>
  )
}

/**
 * The itemized detail behind an expense — a scanned receipt, a completed
 * shopping trip, or a dashboard batch entry (Quick Add's itemized mode)
 * all go through the same recording path, which snapshots each line
 * (name, quantity, category) into price history at the moment it's
 * recorded. Reading it back from there — rather than from the shopping
 * list's own, separately-editable items — means this stays correct even
 * after that list (or its items) is later renamed or deleted: the
 * Shopping page and a transaction's own history are separate features,
 * and cleaning up one must never erase the other's record of what was
 * actually bought.
 */
const ItemizedPurchase = ({ transactionId }: { transactionId: string }) => {
  const [items, setItems] = useState<ItemPurchaseDetail[] | null>(null)

  useEffect(() => {
    let cancelled = false
    void listPurchasesForTransaction(transactionId).then((rows) => {
      if (!cancelled) setItems(rows)
    })
    return () => {
      cancelled = true
    }
  }, [transactionId])

  if (items === null) return <p className="mt-2 text-xs text-muted">Loading items…</p>
  if (items.length === 0) return null

  return (
    <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
      {items.map((item, i) => (
        <li
          key={i}
          className="flex items-center justify-between px-2.5 py-1.5 text-xs"
        >
          <span>
            {item.name}
            {item.quantity !== 1 && (
              <span className="text-muted">
                {' '}
                {Number.isInteger(item.quantity)
                  ? `× ${item.quantity}`
                  : `${item.quantity}kg`}
              </span>
            )}
            {item.categoryName && (
              <span className="text-muted"> · {item.categoryName}</span>
            )}
          </span>
          <span className="tabular-nums text-muted">
            {formatMoney(item.amountMinor)}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Fixing a mistake on an already-recorded transaction — the wrong account,
 * a typo, the wrong amount, the wrong category (Roadmap feedback). A
 * transaction that came from a bill payment or a shopping trip can still
 * be corrected here, but the linked record (the bill's own payment
 * history, the shopping item) won't follow the edit — said plainly rather
 * than silently drifting out of sync.
 */
const EditTransactionForm = ({
  txn,
  onDone,
}: {
  txn: Transaction
  onDone: () => void
}) => {
  const { accounts, editTransaction } = useMoney()
  const activeAccounts = accounts.filter((a) => a.status === 'ACTIVE')

  const [title, setTitle] = useState(txn.title)
  const [amount, setAmount] = useState((txn.amountMinor / 100).toFixed(2))
  const [date, setDate] = useState(txn.occurredAt.slice(0, 10))
  // Defaults to whatever time-of-day the transaction already has, so
  // leaving it alone keeps it exactly as-is — but it's still editable, so
  // a record already flattened to midnight by an earlier edit (before
  // this field existed) can be nudged back to roughly the right time.
  const [time, setTime] = useState(timeOfDay(txn.occurredAt))
  const [accountId, setAccountId] = useState(txn.accountId)
  const [destinationAccountId, setDestinationAccountId] = useState(
    txn.destinationAccountId ?? '',
  )
  const [categoryId, setCategoryId] = useState(txn.categoryId ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const amountMinor = parseAmountToMinor(amount)
    if (amountMinor === null || amountMinor <= 0) {
      setError('Enter an amount greater than zero')
      return
    }
    if (!date) {
      setError('Pick a date')
      return
    }
    setError('')
    setBusy(true)
    try {
      await editTransaction(txn.id, {
        title,
        amountMinor,
        accountId,
        occurredAt: combineDateAndTime(date, time),
        ...(txn.type === 'TRANSFER'
          ? { destinationAccountId: destinationAccountId || null }
          : {}),
        categoryId: categoryId || null,
      })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <tr className="bg-panel-2/40">
      <td colSpan={4} className="px-3 py-3">
      <form onSubmit={submit} className="space-y-2">
        {txn.sourceType !== 'MANUAL' && (
          <p className="text-xs text-warning">
            This came from{' '}
            {txn.sourceType === 'BILL_PAYMENT' ? 'a bill payment' : 'a shopping trip'}
            — that record won't follow this edit.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What for?"
            required
            className="input min-w-[8rem] flex-1"
          />
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="Amount"
            className="input w-24"
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            className="input w-auto"
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            title="Time — only changes the day/time shown here, not what it's linked to"
            className="input w-auto"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="select w-auto"
          >
            {activeAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          {txn.type === 'TRANSFER' && (
            <select
              value={destinationAccountId}
              onChange={(e) => setDestinationAccountId(e.target.value)}
              className="select w-auto"
            >
              <option value="">To…</option>
              {activeAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
          {txn.type !== 'TRANSFER' && (
            <CategoryPicker
              kind={txn.type === 'INCOME' ? 'INCOME' : 'EXPENSE'}
              value={categoryId}
              onChange={setCategoryId}
            />
          )}
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" variant="primary" size="sm" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
          <Button type="button" size="sm" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
      </td>
    </tr>
  )
}

const Row = ({
  txn,
  accountName,
  unseen,
  onOpen,
}: {
  txn: Transaction
  accountName: (id: string | null | undefined) => string
  unseen: boolean
  onOpen: () => void
}) => {
  const { canEdit, removeTransaction, setTransactionVisibility } = useMoney()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const isMine = txn.createdBy === user?.id

  if (editing) {
    return <EditTransactionForm txn={txn} onDone={() => setEditing(false)} />
  }

  return (
    <>
      <tr className={unseen ? 'bg-brand/5' : undefined}>
        <td className="w-10">
          <span className="relative inline-flex">
            <TypeBadge type={txn.type} />
            {unseen && (
              <span
                aria-label="New, not yet seen"
                title="Added by someone else since you last checked"
                className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-panel bg-brand"
              />
            )}
          </span>
        </td>
        <td>
          <p className="font-medium text-ink">{txn.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted">
            <span>{new Date(txn.occurredAt).toLocaleDateString()}</span>
            <span aria-hidden="true">·</span>
            <span>
              {txn.type === 'TRANSFER'
                ? `${accountName(txn.accountId)} → ${accountName(txn.destinationAccountId)}`
                : accountName(txn.accountId)}
            </span>
            {txn.categoryName && (
              <>
                <span aria-hidden="true">·</span>
                <span>{txn.categoryName}</span>
              </>
            )}
            {txn.visibility === 'PRIVATE' && (
              <span className="inline-flex items-center gap-0.5 text-warning">
                <IconLock size={12} /> private
              </span>
            )}
          </p>
        </td>
        <td className="text-right">
          <span
            className={`whitespace-nowrap font-medium tabular-nums ${
              txn.type === 'INCOME'
                ? 'text-success'
                : txn.type === 'EXPENSE'
                  ? 'text-danger'
                  : 'text-ink'
            }`}
          >
            {formatMoney(txn.amountMinor, txn.currency)}
          </span>
        </td>
        <td className="text-right">
          <span className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              aria-label={open ? 'Close details' : 'Details'}
              title={open ? 'Close details' : 'Details'}
              onClick={() => {
                setOpen((v) => !v)
                if (!open) onOpen()
              }}
            >
              {open ? <IconEyeOff size={16} /> : <IconEye size={16} />}
            </Button>
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                aria-label="Edit"
                title="Edit"
                onClick={() => setEditing(true)}
              >
                <IconEdit size={16} />
              </Button>
            )}
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                aria-label="Delete"
                title="Delete"
                className="hover:text-danger"
                onClick={() => void removeTransaction(txn.id)}
              >
                <IconTrash size={16} />
              </Button>
            )}
          </span>
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={4} className="bg-panel-2/40 px-3 py-3">
            {txn.type === 'EXPENSE' && <ItemizedPurchase transactionId={txn.id} />}
            {isMine && (
              <button
                type="button"
                onClick={() =>
                  void setTransactionVisibility(
                    txn.id,
                    txn.visibility === 'PRIVATE' ? 'SPACE' : 'PRIVATE',
                  )
                }
                className="mt-2 text-xs text-muted underline"
              >
                {txn.visibility === 'PRIVATE'
                  ? 'share with the space'
                  : 'make private'}
              </button>
            )}
            <Attachments entityType="TRANSACTION" entityId={txn.id} />
          </td>
        </tr>
      )}
    </>
  )
}

type DateMode = 'any' | 'day' | 'month' | 'year'

/** [startIso, endIso) for whichever date filter is active, or null for "any". */
const dateModeRange = (mode: DateMode, value: string): [string, string] | null => {
  if (mode === 'any' || !value) return null
  if (mode === 'day') {
    const start = new Date(`${value}T00:00:00.000Z`)
    return [start.toISOString(), new Date(start.getTime() + 86_400_000).toISOString()]
  }
  if (mode === 'month') {
    const [y, m] = value.split('-').map(Number)
    return [
      new Date(Date.UTC(y, m - 1, 1)).toISOString(),
      new Date(Date.UTC(y, m, 1)).toISOString(),
    ]
  }
  const y = Number(value)
  if (!Number.isInteger(y)) return null
  return [
    new Date(Date.UTC(y, 0, 1)).toISOString(),
    new Date(Date.UTC(y + 1, 0, 1)).toISOString(),
  ]
}

/** Prev/Next plus a small window of clickable page numbers around the current one. */
const Pagination = ({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (page: number) => void
}) => {
  if (totalPages <= 1) return null

  const windowStart = Math.max(1, Math.min(page - 2, totalPages - 4))
  const windowEnd = Math.min(totalPages, windowStart + 4)
  const pages = Array.from(
    { length: windowEnd - windowStart + 1 },
    (_, i) => windowStart + i,
  )

  const pageBtn = (n: number) => (
    <button
      key={n}
      type="button"
      onClick={() => onChange(n)}
      className={`min-w-[1.75rem] rounded px-1.5 py-1 text-xs ${
        n === page ? 'bg-brand text-brand-ink' : 'text-muted hover:bg-panel-2'
      }`}
    >
      {n}
    </button>
  )

  return (
    <div className="mt-3 flex items-center justify-center gap-1 border-t border-line pt-3">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="rounded px-2 py-1 text-xs text-muted hover:bg-panel-2 disabled:opacity-40"
      >
        ‹ Prev
      </button>
      {windowStart > 1 && <span className="px-1 text-xs text-muted">…</span>}
      {pages.map(pageBtn)}
      {windowEnd < totalPages && <span className="px-1 text-xs text-muted">…</span>}
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="rounded px-2 py-1 text-xs text-muted hover:bg-panel-2 disabled:opacity-40"
      >
        Next ›
      </button>
    </div>
  )
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200]

const TransactionList = () => {
  const { accounts, categories } = useMoney()
  const { user } = useAuth()
  const { ctx } = useMutationContext()

  const [all, setAll] = useState<Transaction[] | null>(null)
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null)
  const [openedIds, setOpenedIds] = useState<Set<string>>(new Set())

  const [search, setSearch] = useState('')
  const [accountFilter, setAccountFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [dateMode, setDateMode] = useState<DateMode>('any')
  const [dateValue, setDateValue] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [pageSize, setPageSize] = useState(() => loadAppearance().defaultPageSize)
  const [page, setPage] = useState(1)

  // `ctx` is a fresh object every render (useMutationContext doesn't memoize
  // it) — depending on the object itself instead of its stable spaceId would
  // re-run these effects on every keystroke, re-scanning the whole space and
  // (worse) prematurely marking everything "seen" while still on the page.
  const spaceId = ctx?.spaceId

  const load = useCallback(async () => {
    if (!spaceId) return
    const rows = await listTransactions(spaceId)
    // Same rule as everywhere else — a private record is only shown to
    // whoever created it (Product Spec §22).
    setAll(rows.filter((t) => t.visibility !== 'PRIVATE' || t.createdBy === user?.id))
  }, [spaceId, user?.id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])
  useEffect(() => onDataChanged(() => void load()), [load])

  // "Seen" cursor for this section — read once on arrival, advanced to now
  // on the way out, so anything added by someone else while you were here
  // stops being highlighted the *next* time you visit, not mid-visit.
  useEffect(() => {
    if (!spaceId) return
    void getLastSeenAt(SEEN_AREA, spaceId).then(setLastSeenAt)
    return () => {
      void markSeenNow(SEEN_AREA, spaceId)
    }
  }, [spaceId])

  const markOpened = useCallback((id: string) => {
    setOpenedIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  const nameById = useMemo(
    () => new Map(accounts.map((a) => [a.id, a.name])),
    [accounts],
  )
  const accountName = (id: string | null | undefined) =>
    (id && nameById.get(id)) || '?'

  const dateRange = useMemo(
    () => dateModeRange(dateMode, dateValue),
    [dateMode, dateValue],
  )

  const filtered = useMemo(() => {
    if (!all) return []
    const minMinor = minAmount.trim() ? parseAmountToMinor(minAmount) : null
    const maxMinor = maxAmount.trim() ? parseAmountToMinor(maxAmount) : null
    const q = search.trim().toLowerCase()

    return all.filter((t) => {
      if (
        accountFilter &&
        t.accountId !== accountFilter &&
        t.destinationAccountId !== accountFilter
      )
        return false
      if (categoryFilter && t.categoryId !== categoryFilter) return false
      if (dateRange && (t.occurredAt < dateRange[0] || t.occurredAt >= dateRange[1]))
        return false
      if (minMinor != null && t.amountMinor < minMinor) return false
      if (maxMinor != null && t.amountMinor > maxMinor) return false
      if (q && !t.title.toLowerCase().includes(q)) return false
      return true
    })
  }, [all, accountFilter, categoryFilter, dateRange, minAmount, maxAmount, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const clampedPage = Math.min(page, totalPages)
  const pageRows = filtered.slice(
    (clampedPage - 1) * pageSize,
    clampedPage * pageSize,
  )

  if (all === null) {
    return (
      <section className="card divide-y">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </section>
    )
  }

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Records</h2>
        <span className="text-xs text-muted">
          {filtered.length} of {all.length}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-b border-line pb-3 text-sm">
        <span className="relative min-w-[9rem] flex-1">
          <IconSearch
            size={15}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search title…"
            className="input pl-8"
          />
        </span>
        <select
          value={accountFilter}
          onChange={(e) => {
            setAccountFilter(e.target.value)
            setPage(1)
          }}
          className="select w-auto"
        >
          <option value="">Any account</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value)
            setPage(1)
          }}
          className="select w-auto"
        >
          <option value="">Any category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={dateMode}
          onChange={(e) => {
            setDateMode(e.target.value as DateMode)
            setDateValue('')
            setPage(1)
          }}
          className="select w-auto"
        >
          <option value="any">Any date</option>
          <option value="day">A day</option>
          <option value="month">A month</option>
          <option value="year">A year</option>
        </select>
        {dateMode === 'day' && (
          <input
            type="date"
            value={dateValue}
            onChange={(e) => {
              setDateValue(e.target.value)
              setPage(1)
            }}
            className="input w-auto"
          />
        )}
        {dateMode === 'month' && (
          <input
            type="month"
            value={dateValue}
            onChange={(e) => {
              setDateValue(e.target.value)
              setPage(1)
            }}
            className="input w-auto"
          />
        )}
        {dateMode === 'year' && (
          <input
            type="number"
            inputMode="numeric"
            placeholder="YYYY"
            value={dateValue}
            onChange={(e) => {
              setDateValue(e.target.value)
              setPage(1)
            }}
            className="input w-20"
          />
        )}
        <input
          value={minAmount}
          onChange={(e) => {
            setMinAmount(e.target.value)
            setPage(1)
          }}
          inputMode="decimal"
          placeholder="Min ₱"
          className="input w-20"
        />
        <input
          value={maxAmount}
          onChange={(e) => {
            setMaxAmount(e.target.value)
            setPage(1)
          }}
          inputMode="decimal"
          placeholder="Max ₱"
          className="input w-20"
        />
        <label className="ml-auto flex items-center gap-1.5 text-xs text-muted">
          Show
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setPage(1)
            }}
            className="select w-auto"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          per page
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="py-4 text-sm text-muted">
          {all.length === 0 ? 'No transactions yet.' : 'Nothing matches those filters.'}
        </p>
      ) : (
        <div className="table-wrap mt-3">
          <table className="table">
            <thead>
              <tr>
                <th aria-hidden="true"></th>
                <th>Description</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((txn) => (
                <Row
                  key={txn.id}
                  txn={txn}
                  accountName={accountName}
                  unseen={
                    !openedIds.has(txn.id) &&
                    isUnseen(txn.createdAt, txn.createdBy, lastSeenAt, user?.id)
                  }
                  onOpen={() => markOpened(txn.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={clampedPage} totalPages={totalPages} onChange={setPage} />
    </section>
  )
}

export default TransactionList
