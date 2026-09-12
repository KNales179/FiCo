import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMoney } from '../../hooks/useMoney'
import { useMutationContext } from '../../hooks/useMutationContext'
import {
  openReconciliationFor,
  recordCashCheck,
  resolveCashCheck,
} from '../../features/reconciliation'
import { formatMoney, parseAmountToMinor } from '../../domain/money'
import type { Reconciliation } from '../../types/models'

const CashCheck = () => {
  const { accounts, canEdit, refresh } = useMoney()
  const { ctx } = useMutationContext()

  const cashAccounts = useMemo(
    () =>
      accounts.filter(
        (a) => a.status === 'ACTIVE' && a.type === 'CASH',
      ),
    [accounts],
  )

  const [accountId, setAccountId] = useState('')
  const [actual, setActual] = useState('')
  const [note, setNote] = useState('')
  const [open, setOpen] = useState<Reconciliation | null>(null)
  const [saved, setSaved] = useState<Reconciliation | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const selectedId = accountId || cashAccounts[0]?.id || ''
  const account = cashAccounts.find((a) => a.id === selectedId)

  const loadOpen = useCallback(async () => {
    setOpen(selectedId ? (await openReconciliationFor(selectedId)) ?? null : null)
  }, [selectedId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOpen()
  }, [loadOpen])

  if (cashAccounts.length === 0) return null

  const expectedMinor = account?.balanceMinor ?? 0
  const actualMinor = actual.trim() === '' ? null : parseAmountToMinor(actual)
  const liveDiff =
    actualMinor != null ? actualMinor - expectedMinor : null

  const save = async () => {
    if (!ctx || actualMinor == null) {
      setError('Enter the cash you counted')
      return
    }
    setBusy(true)
    setError('')
    try {
      const rec = await recordCashCheck(ctx, {
        accountId: selectedId,
        actualMinor,
        note: note.trim() || null,
      })
      setSaved(rec)
      setActual('')
      setNote('')
      await loadOpen()
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  const resolve = async () => {
    if (!ctx || !open) return
    await resolveCashCheck(ctx, open.id, null)
    await loadOpen()
  }

  return (
    <div>
      {cashAccounts.length > 1 && (
        <select
          value={selectedId}
          onChange={(e) => setAccountId(e.target.value)}
          className="mt-2 border px-2 py-1 text-sm"
        >
          {cashAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      )}

      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">Expected (from records)</dt>
          <dd>{formatMoney(expectedMinor, account?.currency)}</dd>
        </div>
        {canEdit && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted">Actual (counted)</dt>
            <dd>
              <input
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className="w-28 border px-2 py-1 text-right"
              />
            </dd>
          </div>
        )}
        {liveDiff != null && (
          <div className="flex justify-between font-medium">
            <dt>Difference</dt>
            <dd className={liveDiff < 0 ? 'text-danger' : liveDiff > 0 ? 'text-amber-600' : ''}>
              {liveDiff > 0 ? '+' : ''}
              {formatMoney(liveDiff, account?.currency)}
            </dd>
          </div>
        )}
      </dl>

      {canEdit && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            maxLength={500}
            className="min-w-[8rem] flex-1 border px-2 py-1 text-sm"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="border px-3 py-1 text-sm disabled:opacity-50"
          >
            Save check
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}

      {saved && saved.differenceMinor !== 0 && (
        <p className="mt-2 text-xs text-amber-700">
          Saved. Difference of{' '}
          {formatMoney(saved.differenceMinor, account?.currency)} recorded —
          it stays flagged until you resolve it. Fico won't invent a
          transaction to hide it.
        </p>
      )}
      {saved && saved.differenceMinor === 0 && (
        <p className="mt-2 text-xs text-success">
          Saved — your cash matches your records.
        </p>
      )}

      {open && (
        <div className="mt-3 rounded bg-amber-50 p-2 text-xs text-amber-800">
          Unresolved cash difference from{' '}
          {new Date(open.createdAt).toLocaleDateString()}:{' '}
          {formatMoney(open.differenceMinor, account?.currency)}
          {open.note && ` — "${open.note}"`}
          {canEdit && (
            <button
              type="button"
              onClick={() => void resolve()}
              className="ml-2 underline"
            >
              mark resolved
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default CashCheck
