import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMoney } from '../../hooks/useMoney'
import { useAuth } from '../../hooks/useAuth'
import { formatMoney, parseAmountToMinor } from '../../domain/money'
import { listItems } from '../../features/shopping/items'
import { listPurchasesForTransaction, type ItemPurchaseDetail } from '../../features/items'
import Attachments from '../Attachments'
import CategoryPicker from './CategoryPicker'
import type { Transaction, ShoppingItem } from '../../types/models'

const SIGN: Record<string, string> = {
  INCOME: '+',
  EXPENSE: '−',
  TRANSFER: '→',
}

/** The itemized detail behind a rolled-up shopping trip (Roadmap Phase 26 feedback). */
const ReceiptItems = ({ listId }: { listId: string }) => {
  const [items, setItems] = useState<ShoppingItem[] | null>(null)

  useEffect(() => {
    let cancelled = false
    void listItems(listId).then((rows) => {
      if (!cancelled) setItems(rows.filter((i) => i.purchased))
    })
    return () => {
      cancelled = true
    }
  }, [listId])

  if (items === null) return <p className="mt-2 text-xs text-muted">Loading items…</p>
  if (items.length === 0) return null

  return (
    <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
      {items.map((item) => (
        <li
          key={item.id}
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
          </span>
          <span className="tabular-nums text-muted">
            {item.actualPriceMinor != null
              ? formatMoney(item.actualPriceMinor)
              : '—'}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** The itemized detail behind a dashboard batch entry (Quick Add's itemized
 *  mode) — unlike a scanned receipt, it has no shopping list to read items
 *  from, so this reads the same price-history rows back by transaction. */
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
          <span>{item.name}</span>
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
        occurredAt: new Date(`${date}T00:00:00.000Z`).toISOString(),
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
    <li className="py-2 text-sm">
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
          <button
            type="submit"
            disabled={busy}
            className="text-xs text-brand underline disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={onDone} className="text-xs text-muted underline">
            Cancel
          </button>
        </div>
      </form>
    </li>
  )
}

const Row = ({
  txn,
  accountName,
}: {
  txn: Transaction
  accountName: (id: string | null | undefined) => string
}) => {
  const { canEdit, removeTransaction, setTransactionVisibility } = useMoney()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const isMine = txn.createdBy === user?.id
  const isShoppingTrip = txn.sourceType === 'SHOPPING_LIST' && txn.sourceId

  if (editing) {
    return <EditTransactionForm txn={txn} onDone={() => setEditing(false)} />
  }

  return (
    <li className="py-2 text-sm">
      <div className="flex items-center justify-between">
        <span>
          <span className="font-medium">{txn.title}</span>
          <span className="ml-2 text-xs text-muted">
            {new Date(txn.occurredAt).toLocaleDateString()} ·{' '}
            {txn.type === 'TRANSFER'
              ? `${accountName(txn.accountId)} → ${accountName(
                  txn.destinationAccountId,
                )}`
              : accountName(txn.accountId)}
            {txn.categoryName && ` · ${txn.categoryName}`}
            {txn.visibility === 'PRIVATE' && (
              <span className="ml-1 text-amber-600">· private</span>
            )}
          </span>
        </span>

        <span className="flex items-center gap-3">
          <span
            className={
              txn.type === 'INCOME'
                ? 'text-success'
                : txn.type === 'EXPENSE'
                  ? 'text-danger'
                  : 'text-muted'
            }
          >
            {SIGN[txn.type]} {formatMoney(txn.amountMinor, txn.currency)}
          </span>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-xs text-muted underline"
          >
            {open ? 'close' : 'details'}
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs text-muted underline"
            >
              edit
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => void removeTransaction(txn.id)}
              className="text-xs text-muted underline"
            >
              delete
            </button>
          )}
        </span>
      </div>

      {open && (
        <>
          {isShoppingTrip && <ReceiptItems listId={txn.sourceId!} />}
          {!isShoppingTrip && txn.type === 'EXPENSE' && (
            <ItemizedPurchase transactionId={txn.id} />
          )}
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
        </>
      )}
    </li>
  )
}

const TransactionList = () => {
  const { transactions, accounts } = useMoney()

  const nameById = useMemo(
    () => new Map(accounts.map((a) => [a.id, a.name])),
    [accounts],
  )
  const accountName = (id: string | null | undefined) =>
    (id && nameById.get(id)) || '?'

  if (transactions.length === 0) {
    return (
      <section className="card text-sm text-muted">
        No transactions yet.
      </section>
    )
  }

  return (
    <section className="card">
      <h2 className="text-lg font-semibold">Recent</h2>
      <ul className="mt-3 divide-y">
        {transactions.map((txn) => (
          <Row key={txn.id} txn={txn} accountName={accountName} />
        ))}
      </ul>
    </section>
  )
}

export default TransactionList
