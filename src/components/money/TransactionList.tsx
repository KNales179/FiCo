import { useEffect, useMemo, useState } from 'react'
import { useMoney } from '../../hooks/useMoney'
import { useAuth } from '../../hooks/useAuth'
import { formatMoney } from '../../domain/money'
import { listItems } from '../../features/shopping/items'
import Attachments from '../Attachments'
import type { ShoppingItem, Transaction } from '../../types/models'

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
            {item.quantity > 1 && (
              <span className="text-muted"> × {item.quantity}</span>
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
  const isMine = txn.createdBy === user?.id
  const isShoppingTrip = txn.sourceType === 'SHOPPING_LIST' && txn.sourceId

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
            {open ? 'close' : isShoppingTrip ? 'items' : 'receipt'}
          </button>
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
