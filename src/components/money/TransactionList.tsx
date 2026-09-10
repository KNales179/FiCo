import { useMemo, useState } from 'react'
import { useMoney } from '../../hooks/useMoney'
import { formatMoney } from '../../domain/money'
import Attachments from '../Attachments'
import type { Transaction } from '../../types/models'

const SIGN: Record<string, string> = {
  INCOME: '+',
  EXPENSE: '−',
  TRANSFER: '→',
}

const Row = ({
  txn,
  accountName,
}: {
  txn: Transaction
  accountName: (id: string | null | undefined) => string
}) => {
  const { canEdit, removeTransaction } = useMoney()
  const [open, setOpen] = useState(false)

  return (
    <li className="py-2 text-sm">
      <div className="flex items-center justify-between">
        <span>
          <span className="font-medium">{txn.title}</span>
          <span className="ml-2 text-xs text-gray-500">
            {new Date(txn.occurredAt).toLocaleDateString()} ·{' '}
            {txn.type === 'TRANSFER'
              ? `${accountName(txn.accountId)} → ${accountName(
                  txn.destinationAccountId,
                )}`
              : accountName(txn.accountId)}
            {txn.categoryName && ` · ${txn.categoryName}`}
          </span>
        </span>

        <span className="flex items-center gap-3">
          <span
            className={
              txn.type === 'INCOME'
                ? 'text-green-700'
                : txn.type === 'EXPENSE'
                  ? 'text-red-600'
                  : 'text-gray-600'
            }
          >
            {SIGN[txn.type]} {formatMoney(txn.amountMinor, txn.currency)}
          </span>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-xs text-gray-500 underline"
          >
            {open ? 'close' : 'receipt'}
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => void removeTransaction(txn.id)}
              className="text-xs text-gray-500 underline"
            >
              delete
            </button>
          )}
        </span>
      </div>

      {open && <Attachments entityType="TRANSACTION" entityId={txn.id} />}
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
      <section className="rounded border p-4 text-sm text-gray-500">
        No transactions yet.
      </section>
    )
  }

  return (
    <section className="rounded border p-4">
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
