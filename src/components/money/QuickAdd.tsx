import { useMemo, useState, type FormEvent } from 'react'
import { useMoney } from '../../hooks/useMoney'
import { parseAmountToMinor } from '../../domain/money'

/**
 * The fast path for everyday entry (Product Spec §38). Amount + what + pay
 * source, one tap to save. Payment source defaults to the space's default
 * account; category and details stay optional and out of the way.
 */
const QuickAdd = () => {
  const { accounts, defaultAccount, canEdit, addTransaction } = useMoney()

  const activeAccounts = useMemo(
    () => accounts.filter((a) => a.status === 'ACTIVE'),
    [accounts],
  )

  const [direction, setDirection] = useState<'EXPENSE' | 'INCOME'>(
    'EXPENSE',
  )
  const [amount, setAmount] = useState('')
  const [title, setTitle] = useState('')
  const [chosenAccountId, setChosenAccountId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  if (!canEdit || activeAccounts.length === 0) return null

  // The chosen account, falling back to the space default, then the first.
  const accountId =
    chosenAccountId || defaultAccount?.id || activeAccounts[0].id

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSaved(false)

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
      })
      setAmount('')
      setTitle('')
      setSaved(true)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded border p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Quick add</h2>
        <div className="flex gap-1 text-sm">
          <button
            type="button"
            onClick={() => setDirection('EXPENSE')}
            className={`border px-2 py-0.5 ${
              direction === 'EXPENSE' ? 'bg-gray-900 text-white' : ''
            }`}
          >
            Spent
          </button>
          <button
            type="button"
            onClick={() => setDirection('INCOME')}
            className={`border px-2 py-0.5 ${
              direction === 'INCOME' ? 'bg-gray-900 text-white' : ''
            }`}
          >
            Received
          </button>
        </div>
      </div>

      <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-2">
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
          className="w-28 border px-2 py-1"
        />
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            setSaved(false)
          }}
          placeholder={direction === 'EXPENSE' ? 'What for?' : 'From?'}
          required
          maxLength={120}
          className="min-w-[8rem] flex-1 border px-2 py-1"
        />
        <select
          value={accountId}
          onChange={(e) => setChosenAccountId(e.target.value)}
          className="border px-2 py-1 text-sm"
        >
          {activeAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.isDefault ? ' •' : ''}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={busy}
          className="border px-3 py-1 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Add'}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="mt-2 text-xs text-green-700">Saved.</p>
      )}
    </section>
  )
}

export default QuickAdd
