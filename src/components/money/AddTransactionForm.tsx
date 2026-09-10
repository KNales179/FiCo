import { useMemo, useState, type FormEvent } from 'react'
import { useMoney } from '../../hooks/useMoney'
import { parseAmountToMinor } from '../../domain/money'
import type { TransactionType } from '../../types/models'

const TYPES: { value: TransactionType; label: string }[] = [
  { value: 'EXPENSE', label: 'Expense' },
  { value: 'INCOME', label: 'Income' },
  { value: 'TRANSFER', label: 'Transfer' },
]

const AddTransactionForm = () => {
  const { accounts, canEdit, addTransaction } = useMoney()

  const activeAccounts = useMemo(
    () => accounts.filter((a) => a.status === 'ACTIVE'),
    [accounts],
  )

  const [type, setType] = useState<TransactionType>('EXPENSE')
  const [amount, setAmount] = useState('')
  const [title, setTitle] = useState('')
  const [accountId, setAccountId] = useState('')
  const [destinationAccountId, setDestinationAccountId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!canEdit) return null

  if (activeAccounts.length === 0) {
    return (
      <section className="rounded border p-4 text-sm text-gray-500">
        Add an account before recording transactions.
      </section>
    )
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const amountMinor = parseAmountToMinor(amount)
    if (amountMinor === null || amountMinor <= 0) {
      setError('Enter an amount greater than zero')
      return
    }

    const source = accountId || activeAccounts[0].id

    setBusy(true)
    try {
      await addTransaction({
        type,
        amountMinor,
        title,
        accountId: source,
        destinationAccountId:
          type === 'TRANSFER'
            ? destinationAccountId ||
              activeAccounts.find((a) => a.id !== source)?.id
            : undefined,
      })
      setAmount('')
      setTitle('')
      setDestinationAccountId('')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not record transaction',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded border p-4">
      <h2 className="text-lg font-semibold">Record something</h2>

      <div className="mt-3 flex gap-2">
        {TYPES.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setType(option.value)}
            className={`border px-3 py-1 text-sm ${
              type === option.value ? 'bg-gray-900 text-white' : ''
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-3 space-y-2">
        <div className="flex gap-2">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="Amount"
            required
            className="w-32 border px-2 py-1 text-sm"
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={type === 'TRANSFER' ? 'Note' : 'What for?'}
            required
            maxLength={120}
            className="flex-1 border px-2 py-1 text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="text-gray-500">
            {type === 'INCOME' ? 'Into' : 'From'}
          </label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="border px-2 py-1"
          >
            {activeAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          {type === 'TRANSFER' && (
            <>
              <label className="text-gray-500">to</label>
              <select
                value={destinationAccountId}
                onChange={(e) =>
                  setDestinationAccountId(e.target.value)
                }
                className="border px-2 py-1"
              >
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        {error && (
          <p role="alert" className="text-xs text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="border px-3 py-1 text-sm disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
      </form>
    </section>
  )
}

export default AddTransactionForm
