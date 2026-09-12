import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useBills } from '../hooks/useBills'
import { useMoney } from '../hooks/useMoney'
import { useAuth } from '../hooks/useAuth'
import { useSpace } from '../hooks/useSpace'
import { formatMoney, parseAmountToMinor } from '../domain/money'
import { costPerKwhMinor } from '../domain/electricity'
import { billPayableFrom, isBillPayable } from '../features/bills'
import { getLastSeenAt, isUnseen, markSeenNow } from '../features/seen'
import CategoryPicker from '../components/money/CategoryPicker'
import type { Bill, BillPayment, BillRecurrence, BillType } from '../types/models'

const SEEN_AREA = 'bills'

/**
 * The most recent payment on a bill, shown inline right on its row — not
 * buried in the collapsible history — so paying one never looks like it
 * silently failed (owner feedback: "it look like it's not payed yet
 * unless I check the date and the history"). Re-fetches whenever the
 * bill's own due date moves, which is exactly what a new payment does.
 */
const LastPaid = ({
  bill,
  lastSeenAt,
  currentUserId,
}: {
  bill: Bill
  lastSeenAt: string | null
  currentUserId: string | undefined
}) => {
  const { paymentsFor } = useBills()
  const [payment, setPayment] = useState<BillPayment | null | undefined>(
    undefined,
  )

  useEffect(() => {
    let cancelled = false
    void paymentsFor(bill.id).then((rows) => {
      if (cancelled) return
      const latest = rows
        .filter((p) => !p.deletedAt)
        .sort((a, b) => b.paidAt.localeCompare(a.paidAt))[0]
      setPayment(latest ?? null)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bill.id, bill.nextDueDate])

  if (payment === undefined) return null
  if (payment === null) {
    return <p className="mt-0.5 text-xs text-muted">Not paid yet</p>
  }
  // Someone else paid this since you last checked (owner feedback: "the
  // payment record will be highlighted" — a push notification is the
  // other half of this, sent server-side when the payment is synced up).
  const unseen = isUnseen(payment.createdAt, payment.createdBy, lastSeenAt, currentUserId)
  return (
    <p
      className={`mt-0.5 text-xs text-success ${unseen ? 'rounded bg-danger/10 px-1 py-0.5 ring-1 ring-danger/40' : ''}`}
    >
      {unseen && '🔴 '}✓ paid {formatMoney(payment.amountMinor)} on{' '}
      {new Date(payment.paidAt).toLocaleDateString()}
    </p>
  )
}

/** Inline category picker on an existing bill's row — sets the category for
 *  this bill's *next* payment onward; already-recorded payments keep the
 *  category (or lack of one) they were actually created with (§10). */
const BillCategoryPicker = ({ bill }: { bill: Bill }) => {
  const { updateBill } = useBills()
  const { categories } = useMoney()

  const setCategory = (categoryId: string) => {
    const categoryName = categoryId
      ? categories.find((c) => c.id === categoryId)?.name ?? null
      : null
    void updateBill(bill.id, { categoryId: categoryId || null, categoryName })
  }

  return (
    <CategoryPicker
      kind="EXPENSE"
      value={bill.categoryId ?? ''}
      onChange={setCategory}
      className="select w-auto text-xs"
    />
  )
}

const PayRow = ({
  bill,
  lastSeenAt,
  currentUserId,
}: {
  bill: Bill
  lastSeenAt: string | null
  currentUserId: string | undefined
}) => {
  const { payBill } = useBills()
  const { accounts, defaultAccount } = useMoney()
  const active = accounts.filter((a) => a.status === 'ACTIVE')

  const [amount, setAmount] = useState(
    bill.expectedAmountMinor != null
      ? String(bill.expectedAmountMinor / 100)
      : '',
  )
  const [accountId, setAccountId] = useState('')
  const [kwh, setKwh] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Paying far ahead of schedule is what made an already-paid bill look
  // unpaid until someone checked the date and history (owner feedback) —
  // so the pay form itself doesn't show up until it's actually due soon,
  // or already overdue.
  const payable = isBillPayable(bill.nextDueDate, new Date().toISOString())

  const submit = async () => {
    setError('')
    const minor = parseAmountToMinor(amount)
    if (minor == null || minor <= 0) {
      setError('Enter the amount paid')
      return
    }
    setBusy(true)
    try {
      await payBill(bill.id, {
        amountMinor: minor,
        accountId: accountId || defaultAccount?.id || active[0]?.id || '',
        electricity:
          bill.tracksElectricity && kwh.trim() !== ''
            ? { consumptionKwh: Number(kwh) || null }
            : null,
      })
      setKwh('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record payment')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="py-1.5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-[7rem] flex-1">
          {bill.name}
          <span className="ml-2 text-xs text-muted">
            due {new Date(bill.nextDueDate).toLocaleDateString()} ·{' '}
            {bill.recurrence.toLowerCase()} · {bill.billType.toLowerCase()}
          </span>
        </span>
        {payable ? (
          <>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="Amount"
              className="w-24 border px-2 py-1"
            />
            <select
              value={accountId || defaultAccount?.id || ''}
              onChange={(e) => setAccountId(e.target.value)}
              className="border px-2 py-1"
            >
              {active.length === 0 && <option value="">No accounts</option>}
              {active.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {bill.tracksElectricity && (
              <input
                value={kwh}
                onChange={(e) => setKwh(e.target.value)}
                inputMode="decimal"
                placeholder="kWh"
                className="w-20 border px-2 py-1"
              />
            )}
            <button
              type="button"
              disabled={busy || active.length === 0}
              onClick={() => void submit()}
              className="border px-3 py-1 disabled:opacity-50"
            >
              Pay
            </button>
          </>
        ) : (
          <span className="text-xs text-muted">
            Payable starting {new Date(billPayableFrom(bill.nextDueDate)).toLocaleDateString()}
          </span>
        )}
      </div>
      {error && <span className="text-xs text-danger">{error}</span>}
      <LastPaid bill={bill} lastSeenAt={lastSeenAt} currentUserId={currentUserId} />
    </div>
  )
}

const History = ({ billId, canEdit }: { billId: string; canEdit: boolean }) => {
  const { paymentsFor, deletePayment } = useBills()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<BillPayment[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const refresh = async () => setRows(await paymentsFor(billId))

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (next && rows === null) await refresh()
  }

  const remove = async (paymentId: string) => {
    if (
      !window.confirm(
        'Delete this payment? This also removes the linked expense and rolls the due date back.',
      )
    )
      return
    setError('')
    setBusyId(paymentId)
    try {
      await deletePayment(paymentId)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete payment')
    } finally {
      setBusyId(null)
    }
  }

  const visible = (rows ?? []).filter((p) => !p.deletedAt)

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => void toggle()}
        className="text-xs text-muted underline"
      >
        {open ? 'hide history' : 'payment history'}
      </button>
      {open && rows && (
        <>
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
          <ul className="mt-1 text-xs text-muted">
            {visible.length === 0 && <li>No payments yet.</li>}
            {visible.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-0.5">
                <span>
                  {new Date(p.paidAt).toLocaleDateString()} —{' '}
                  {formatMoney(p.amountMinor)} ({p.periodKey})
                </span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => void remove(p.id)}
                    disabled={busyId === p.id}
                    className="underline hover:text-danger disabled:opacity-50"
                  >
                    {busyId === p.id ? 'deleting…' : 'delete'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

const Bills = () => {
  const {
    bills,
    deletedBills,
    electricity,
    loading,
    error,
    canEdit,
    createBill,
    deleteBill,
    restoreBill,
    deletePayment,
  } = useBills()
  const { categories } = useMoney()
  const { user } = useAuth()
  const { activeSpaceId } = useSpace()
  const [electricityBusyId, setElectricityBusyId] = useState<string | null>(null)
  const [electricityError, setElectricityError] = useState('')
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null)

  // "Seen" cursor for this section (Roadmap feedback: a bill someone else
  // added, or a payment someone else made, stays highlighted until you
  // open this page — a push notification is the other half of this, sent
  // server-side when the bill/payment is synced up).
  useEffect(() => {
    if (!activeSpaceId) return
    void getLastSeenAt(SEEN_AREA, activeSpaceId).then(setLastSeenAt)
    return () => {
      void markSeenNow(SEEN_AREA, activeSpaceId)
    }
  }, [activeSpaceId])

  const removeElectricityRecord = async (billPaymentId: string) => {
    if (
      !window.confirm(
        'Delete this payment? This also removes the linked expense and rolls the due date back.',
      )
    )
      return
    setElectricityError('')
    setElectricityBusyId(billPaymentId)
    try {
      await deletePayment(billPaymentId)
    } catch (err) {
      setElectricityError(
        err instanceof Error ? err.message : 'Could not delete payment',
      )
    } finally {
      setElectricityBusyId(null)
    }
  }

  const [name, setName] = useState('')
  const [recurrence, setRecurrence] = useState<BillRecurrence>('MONTHLY')
  const [billType, setBillType] = useState<BillType>('FIXED')
  const [expected, setExpected] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [tracksElectricity, setTracksElectricity] = useState(false)
  const [categoryId, setCategoryId] = useState(
    () => categories.find((c) => c.name === 'Bills')?.id ?? '',
  )
  const [formError, setFormError] = useState('')

  const horizon = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 45)
    return d.toISOString()
  }, [])

  const upcoming = bills.filter(
    (b) => b.active && b.nextDueDate <= horizon,
  )
  const active = bills.filter((b) => b.active)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError('')
    const expectedMinor =
      expected.trim() === '' ? null : parseAmountToMinor(expected)
    if (expectedMinor === undefined) {
      setFormError('Expected amount is not valid')
      return
    }
    const due = dueDate
      ? new Date(dueDate + 'T00:00:00.000Z').toISOString()
      : null
    if (!due) {
      setFormError('Pick the next due date')
      return
    }
    try {
      await createBill({
        name,
        recurrence,
        billType,
        nextDueDate: due,
        expectedAmountMinor: expectedMinor,
        tracksElectricity,
        categoryId: categoryId || null,
        categoryName: categoryId
          ? categories.find((c) => c.id === categoryId)?.name ?? null
          : null,
      })
      setName('')
      setExpected('')
      setDueDate('')
      setTracksElectricity(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create bill')
    }
  }

  if (loading) return <p className="text-sm text-muted">Loading…</p>

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Bills</h1>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <section className="card">
        <h2 className="text-lg font-semibold">Upcoming</h2>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            Nothing due in the next 45 days.
          </p>
        ) : (
          <div className="mt-2 divide-y">
            {upcoming.map((bill) => (
              <PayRow
                key={bill.id}
                bill={bill}
                lastSeenAt={lastSeenAt}
                currentUserId={user?.id}
              />
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">All bills</h2>
        <ul className="mt-2 divide-y">
          {active.map((bill) => {
            const billUnseen = isUnseen(bill.createdAt, bill.createdBy, lastSeenAt, user?.id)
            return (
              <li
                key={bill.id}
                className={`py-2 text-sm ${billUnseen ? 'bg-danger/5' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span>
                    {billUnseen && (
                      <span
                        aria-label="New, not yet seen"
                        className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-danger align-middle"
                      />
                    )}
                    {bill.name}
                    <span className="ml-2 text-xs text-muted">
                      next {new Date(bill.nextDueDate).toLocaleDateString()}
                      {bill.expectedAmountMinor != null &&
                        ` · ~${formatMoney(bill.expectedAmountMinor)}`}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {canEdit && <BillCategoryPicker bill={bill} />}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete "${bill.name}"? This removes the whole bill, not just one payment — its payment history stays intact and can be restored later. To fix one wrong payment instead, use "delete" under that payment's own history below.`,
                            )
                          )
                            void deleteBill(bill.id)
                        }}
                        className="text-xs text-muted underline"
                      >
                        delete
                      </button>
                    )}
                  </span>
                </div>
                <LastPaid bill={bill} lastSeenAt={lastSeenAt} currentUserId={user?.id} />
                <History billId={bill.id} canEdit={canEdit} />
              </li>
            )
          })}
          {active.length === 0 && (
            <li className="py-2 text-sm text-muted">No bills yet.</li>
          )}
        </ul>
      </section>

      {canEdit && deletedBills.length > 0 && (
        <section className="card">
          <h2 className="text-lg font-semibold">Deleted bills</h2>
          <p className="mt-1 text-xs text-muted">
            Deleted by mistake? Restore brings it back as active, exactly as
            it was — its payment history comes with it.
          </p>
          <ul className="mt-2 divide-y">
            {deletedBills.map((bill) => (
              <li key={bill.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {bill.name}
                  <span className="ml-2 text-xs text-muted">
                    was due {new Date(bill.nextDueDate).toLocaleDateString()}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={restoringId === bill.id}
                  onClick={async () => {
                    setRestoringId(bill.id)
                    try {
                      await restoreBill(bill.id)
                    } finally {
                      setRestoringId(null)
                    }
                  }}
                  className="text-xs text-muted underline hover:text-ink disabled:opacity-50"
                >
                  {restoringId === bill.id ? 'restoring…' : 'restore'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {electricity.length > 0 && (
        <section className="card">
          <h2 className="text-lg font-semibold">Electricity</h2>
          {electricityError && (
            <p role="alert" className="mt-1 text-xs text-danger">
              {electricityError}
            </p>
          )}
          <table className="mt-2 w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="py-1">Period</th>
                <th className="py-1 text-right">Amount</th>
                <th className="py-1 text-right">kWh</th>
                <th className="py-1 text-right">₱/kWh</th>
                {canEdit && <th className="py-1" />}
              </tr>
            </thead>
            <tbody>
              {electricity.map((r) => {
                const perKwh = costPerKwhMinor(
                  r.amountMinor,
                  r.consumptionKwh,
                )
                return (
                  <tr key={r.id} className="border-t">
                    <td className="py-1">{r.billingPeriod}</td>
                    <td className="py-1 text-right">
                      {formatMoney(r.amountMinor)}
                    </td>
                    <td className="py-1 text-right">
                      {r.consumptionKwh ?? '—'}
                    </td>
                    <td className="py-1 text-right">
                      {perKwh != null ? formatMoney(perKwh) : '—'}
                    </td>
                    {canEdit && (
                      <td className="py-1 text-right">
                        <button
                          type="button"
                          onClick={() => void removeElectricityRecord(r.billPaymentId)}
                          disabled={electricityBusyId === r.billPaymentId}
                          className="text-xs text-muted underline hover:text-danger disabled:opacity-50"
                        >
                          {electricityBusyId === r.billPaymentId ? 'deleting…' : 'delete'}
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}

      {canEdit && (
        <form onSubmit={submit} className="card">
          <h2 className="text-lg font-semibold">Add a bill</h2>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (e.g. Electricity)"
              required
              maxLength={80}
              className="min-w-[10rem] flex-1 border px-2 py-1"
            />
            <select
              value={recurrence}
              onChange={(e) =>
                setRecurrence(e.target.value as BillRecurrence)
              }
              className="border px-2 py-1"
            >
              <option value="MONTHLY">monthly</option>
              <option value="YEARLY">yearly</option>
            </select>
            <select
              value={billType}
              onChange={(e) => setBillType(e.target.value as BillType)}
              className="border px-2 py-1"
            >
              <option value="FIXED">fixed</option>
              <option value="VARIABLE">variable</option>
            </select>
            <input
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              inputMode="decimal"
              placeholder="Expected amount"
              className="w-32 border px-2 py-1"
            />
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="border px-2 py-1"
            />
            <CategoryPicker
              kind="EXPENSE"
              value={categoryId}
              onChange={setCategoryId}
              className="border px-2 py-1"
            />
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={tracksElectricity}
                onChange={(e) => setTracksElectricity(e.target.checked)}
              />
              track kWh
            </label>
            <button type="submit" className="border px-3 py-1">
              Add
            </button>
          </div>
          {formError && (
            <p role="alert" className="mt-2 text-xs text-danger">
              {formError}
            </p>
          )}
        </form>
      )}
    </div>
  )
}

export default Bills
