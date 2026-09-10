import { useMemo, useState, type FormEvent } from 'react'
import { useMoney } from '../../hooks/useMoney'
import { parseAmountToMinor } from '../../domain/money'
import { Button } from '../ui'
import CategoryPicker from './CategoryPicker'

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

  const [direction, setDirection] = useState<'EXPENSE' | 'INCOME'>('EXPENSE')
  const [amount, setAmount] = useState('')
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState('')
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
          className="input w-28"
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
          onChange={setCategoryId}
        />
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Saving…' : 'Add'}
        </Button>
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
