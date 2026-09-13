import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useBills } from '../hooks/useBills'
import { useMoney } from '../hooks/useMoney'
import { useAuth } from '../hooks/useAuth'
import { useSpace } from '../hooks/useSpace'
import { formatMoney, parseAmountToMinor } from '../domain/money'
import { costPerKwhMinor } from '../domain/electricity'
import { billPayableFrom, isBillPayable } from '../features/bills'
import { getLastSeenAt, isUnseen, markSeenNow } from '../features/seen'
import { PageHeader, Button, Input, Select, Alert, SkeletonCard } from '../components/ui'
import {
  IconCheck,
  IconChevronDown,
  IconEdit,
  IconPlus,
  IconRotateCcw,
  IconTrash,
  IconX,
} from '../components/icons'
import CategoryPicker from '../components/money/CategoryPicker'
import type { Bill, BillPayment, BillRecurrence, BillType } from '../types/models'

const SEEN_AREA = 'bills'

/** Recurrence-aware — NONE never has a date, and a SCHEDULED bill can
 *  genuinely have nothing lined up until someone adds a date to it. */
const dueDateLabel = (bill: Bill): string => {
  if (bill.recurrence === 'NONE') return 'no fixed due date'
  if (!bill.nextDueDate) return 'nothing scheduled yet'
  return new Date(bill.nextDueDate).toLocaleDateString()
}

const RECURRENCE_LABEL: Record<BillRecurrence, string> = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  SCHEDULED: 'scheduled',
  NONE: 'no fixed schedule',
}

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
      className={`mt-0.5 flex items-center gap-1 text-xs text-success ${unseen ? 'rounded bg-danger/10 px-1 py-0.5 ring-1 ring-danger/40' : ''}`}
    >
      {unseen && (
        <span
          aria-label="New, not yet seen"
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger"
        />
      )}
      <IconCheck size={12} className="shrink-0" />
      paid {formatMoney(payment.amountMinor)} on{' '}
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

/** SCHEDULED only — appends one more date to a bill's calendar whenever
 *  it's actually known (next semester's tuition date isn't set until the
 *  school sets it), instead of requiring every date up front. */
const AddScheduledDate = ({ bill }: { bill: Bill }) => {
  const { addScheduledDate } = useBills()
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const pendingCount = bill.scheduledDates?.length ?? 0

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <IconPlus size={13} />
        Date
        {pendingCount > 0 && (
          <span className="chip">{pendingCount} pending</span>
        )}
      </Button>
    )
  }

  const submit = async () => {
    if (!date) return
    setBusy(true)
    setError('')
    try {
      await addScheduledDate(bill.id, new Date(`${date}T00:00:00.000Z`).toISOString())
      setDate('')
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that date')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="flex items-center gap-1">
      <Input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-auto py-1 text-xs"
      />
      <Button size="sm" variant="primary" onClick={() => void submit()} disabled={busy || !date}>
        {busy ? 'Adding…' : 'Add'}
      </Button>
      <Button size="sm" onClick={() => setOpen(false)}>
        <IconX size={13} />
      </Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  )
}

/**
 * Full edit of an existing bill — name, price type, and the recurrence
 * itself together with whatever dates that recurrence needs (owner
 * request: "add a function to edit bills"). Recurrence and its dates are
 * edited as one unit since switching, say, MONTHLY to SCHEDULED changes
 * what "the date" even means for this bill.
 */
const EditBillForm = ({
  bill,
  onDone,
}: {
  bill: Bill
  onDone: () => void
}) => {
  const { updateBill } = useBills()
  const { categories } = useMoney()

  const [name, setName] = useState(bill.name)
  const [recurrence, setRecurrence] = useState<BillRecurrence>(bill.recurrence)
  const [billType, setBillType] = useState<BillType>(bill.billType)
  const [expected, setExpected] = useState(
    bill.expectedAmountMinor != null
      ? String(bill.expectedAmountMinor / 100)
      : '',
  )
  const [dueDate, setDueDate] = useState(
    bill.recurrence !== 'SCHEDULED' && bill.nextDueDate
      ? bill.nextDueDate.slice(0, 10)
      : '',
  )
  // SCHEDULED only — the bill's current dates, editable here (add or
  // remove), not just appended to one at a time like the row's own
  // "+ Date" button.
  const [scheduledDraft, setScheduledDraft] = useState<string[]>(
    bill.scheduledDates ?? [],
  )
  const [scheduledInput, setScheduledInput] = useState('')
  const [tracksElectricity, setTracksElectricity] = useState(
    bill.tracksElectricity,
  )
  const [categoryId, setCategoryId] = useState(bill.categoryId ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const addDraftDate = () => {
    if (!scheduledInput) return
    const iso = new Date(`${scheduledInput}T00:00:00.000Z`).toISOString()
    setScheduledDraft((dates) =>
      dates.includes(iso) ? dates : [...dates, iso].sort(),
    )
    setScheduledInput('')
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Give the bill a name')
      return
    }

    let expectedMinor: number | null = null
    if (expected.trim() !== '') {
      expectedMinor = parseAmountToMinor(expected)
      if (expectedMinor === null) {
        setError('Expected amount is not valid')
        return
      }
    }

    let nextDueDate: string | null = null
    let scheduledDates: string[] | null = null

    if (recurrence === 'SCHEDULED') {
      if (scheduledDraft.length === 0) {
        setError('Add at least one date')
        return
      }
      scheduledDates = [...scheduledDraft].sort()
      nextDueDate = scheduledDates[0]
    } else if (recurrence !== 'NONE') {
      if (!dueDate) {
        setError('Pick the next due date')
        return
      }
      nextDueDate = new Date(`${dueDate}T00:00:00.000Z`).toISOString()
    }

    setBusy(true)
    try {
      await updateBill(bill.id, {
        name: name.trim(),
        recurrence,
        billType,
        expectedAmountMinor: expectedMinor,
        nextDueDate,
        scheduledDates,
        tracksElectricity,
        categoryId: categoryId || null,
        categoryName: categoryId
          ? categories.find((c) => c.id === categoryId)?.name ?? null
          : null,
      })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save changes')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-2 space-y-3 rounded-lg border border-line bg-panel-2 p-3"
    >
      <div className="flex flex-wrap gap-2 text-sm">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          required
          maxLength={80}
          className="min-w-[10rem] flex-1"
        />
        <Select
          value={recurrence}
          onChange={(e) => setRecurrence(e.target.value as BillRecurrence)}
          className="w-auto"
        >
          <option value="MONTHLY">monthly</option>
          <option value="YEARLY">yearly</option>
          <option value="SCHEDULED">scheduled (specific dates)</option>
          <option value="NONE">no fixed date</option>
        </Select>
        <Select
          value={billType}
          onChange={(e) => setBillType(e.target.value as BillType)}
          className="w-auto"
        >
          <option value="FIXED">fixed</option>
          <option value="VARIABLE">variable</option>
        </Select>
        <Input
          value={expected}
          onChange={(e) => setExpected(e.target.value)}
          inputMode="decimal"
          placeholder="Expected amount"
          className="w-32"
        />
        {(recurrence === 'MONTHLY' || recurrence === 'YEARLY') && (
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-auto"
          />
        )}
        <CategoryPicker
          kind="EXPENSE"
          value={categoryId}
          onChange={setCategoryId}
          className="select w-auto"
        />
        <label className="flex items-center gap-1.5 text-sm text-muted">
          <input
            type="checkbox"
            checked={tracksElectricity}
            onChange={(e) => setTracksElectricity(e.target.checked)}
          />
          Track kWh
        </label>
      </div>

      {recurrence === 'SCHEDULED' && (
        <div className="border-t border-line pt-3">
          <p className="field-label">Dates</p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={scheduledInput}
              onChange={(e) => setScheduledInput(e.target.value)}
              className="w-auto"
            />
            <Button type="button" size="sm" onClick={addDraftDate}>
              <IconPlus size={13} />
              Add date
            </Button>
          </div>
          {scheduledDraft.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {scheduledDraft.map((d) => (
                <li key={d} className="chip">
                  {new Date(d).toLocaleDateString()}
                  <button
                    type="button"
                    aria-label="Remove date"
                    onClick={() =>
                      setScheduledDraft((dates) => dates.filter((x) => x !== d))
                    }
                    className="ml-1 text-muted hover:text-danger"
                  >
                    <IconX size={11} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {recurrence === 'NONE' && (
        <p className="border-t border-line pt-3 text-xs text-muted">
          No due date needed — this bill can be paid any time.
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </Button>
        <Button type="button" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
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
  // or already overdue. NONE (bought whenever it runs out) has no date to
  // gate against, so it's always payable.
  const payable =
    bill.recurrence === 'NONE' ||
    (bill.nextDueDate != null &&
      isBillPayable(bill.nextDueDate, new Date().toISOString()))

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
            {bill.recurrence === 'NONE' ? dueDateLabel(bill) : `due ${dueDateLabel(bill)}`} ·{' '}
            {RECURRENCE_LABEL[bill.recurrence]} · {bill.billType.toLowerCase()}
          </span>
        </span>
        {payable ? (
          <>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="Amount"
              className="w-24"
            />
            <Select
              value={accountId || defaultAccount?.id || ''}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-auto"
            >
              {active.length === 0 && <option value="">No accounts</option>}
              {active.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
            {bill.tracksElectricity && (
              <Input
                value={kwh}
                onChange={(e) => setKwh(e.target.value)}
                inputMode="decimal"
                placeholder="kWh"
                className="w-20"
              />
            )}
            <Button
              variant="primary"
              size="sm"
              disabled={busy || active.length === 0}
              onClick={() => void submit()}
            >
              <IconCheck size={14} />
              {busy ? 'Paying…' : 'Pay'}
            </Button>
          </>
        ) : (
          <span className="text-xs text-muted">
            {bill.nextDueDate
              ? `Payable starting ${new Date(billPayableFrom(bill.nextDueDate)).toLocaleDateString()}`
              : 'Nothing scheduled — add a date below'}
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
        className="flex items-center gap-1 text-xs font-medium text-muted hover:text-ink"
      >
        Payment history
        <IconChevronDown size={13} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
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
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    aria-label="Delete payment"
                    title="Delete payment"
                    onClick={() => void remove(p.id)}
                    disabled={busyId === p.id}
                    className="hover:text-danger"
                  >
                    <IconTrash size={13} />
                  </Button>
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
  const [editingId, setEditingId] = useState<string | null>(null)

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
  // SCHEDULED only — one or more specific dates, built up before submit.
  const [scheduledDraft, setScheduledDraft] = useState<string[]>([])
  const [scheduledInput, setScheduledInput] = useState('')
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

  // NONE has no date to compare against at all — always shown here rather
  // than making "pay the gas bill" require digging into "All bills" every
  // time. A SCHEDULED bill with nothing left on its calendar (nextDueDate
  // null) has genuinely nothing "upcoming" and is correctly left out.
  const upcoming = bills.filter(
    (b) =>
      b.active &&
      (b.recurrence === 'NONE' ||
        (b.nextDueDate != null && b.nextDueDate <= horizon)),
  )
  const active = bills.filter((b) => b.active)

  const addScheduledDraftDate = () => {
    if (!scheduledInput) return
    const iso = new Date(`${scheduledInput}T00:00:00.000Z`).toISOString()
    setScheduledDraft((dates) =>
      dates.includes(iso) ? dates : [...dates, iso].sort(),
    )
    setScheduledInput('')
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError('')
    const expectedMinor =
      expected.trim() === '' ? null : parseAmountToMinor(expected)
    if (expected.trim() !== '' && expectedMinor === null) {
      setFormError('Expected amount is not valid')
      return
    }

    let nextDueDate: string | null = null
    let scheduledDates: string[] | undefined

    if (recurrence === 'SCHEDULED') {
      if (scheduledDraft.length === 0) {
        setFormError('Add at least one date')
        return
      }
      scheduledDates = scheduledDraft
    } else if (recurrence !== 'NONE') {
      if (!dueDate) {
        setFormError('Pick the next due date')
        return
      }
      nextDueDate = new Date(`${dueDate}T00:00:00.000Z`).toISOString()
    }

    try {
      await createBill({
        name,
        recurrence,
        billType,
        nextDueDate,
        scheduledDates,
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
      setScheduledDraft([])
      setScheduledInput('')
      setTracksElectricity(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create bill')
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={3} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Bills" />
      {error && <Alert>{error}</Alert>}

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
                      {bill.recurrence === 'NONE' || !bill.nextDueDate
                        ? dueDateLabel(bill)
                        : `next ${dueDateLabel(bill)}`}
                      {bill.expectedAmountMinor != null &&
                        ` · ~${formatMoney(bill.expectedAmountMinor)}`}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {canEdit && bill.recurrence === 'SCHEDULED' && (
                      <AddScheduledDate bill={bill} />
                    )}
                    {canEdit && <BillCategoryPicker bill={bill} />}
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        aria-label="Edit bill"
                        title="Edit bill"
                        onClick={() =>
                          setEditingId((id) => (id === bill.id ? null : bill.id))
                        }
                      >
                        <IconEdit size={14} />
                      </Button>
                    )}
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        aria-label="Delete bill"
                        title="Delete bill"
                        className="hover:text-danger"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete "${bill.name}"? This removes the whole bill, not just one payment — its payment history stays intact and can be restored later. To fix one wrong payment instead, use "delete" under that payment's own history below.`,
                            )
                          )
                            void deleteBill(bill.id)
                        }}
                      >
                        <IconTrash size={14} />
                      </Button>
                    )}
                  </span>
                </div>
                {editingId === bill.id ? (
                  <EditBillForm
                    bill={bill}
                    onDone={() => setEditingId(null)}
                  />
                ) : (
                  <>
                    <LastPaid bill={bill} lastSeenAt={lastSeenAt} currentUserId={user?.id} />
                    <History billId={bill.id} canEdit={canEdit} />
                  </>
                )}
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
                    {bill.recurrence === 'NONE' || !bill.nextDueDate
                      ? dueDateLabel(bill)
                      : `was due ${dueDateLabel(bill)}`}
                  </span>
                </span>
                <Button
                  size="sm"
                  disabled={restoringId === bill.id}
                  onClick={async () => {
                    setRestoringId(bill.id)
                    try {
                      await restoreBill(bill.id)
                    } finally {
                      setRestoringId(null)
                    }
                  }}
                >
                  <IconRotateCcw size={14} />
                  {restoringId === bill.id ? 'Restoring…' : 'Restore'}
                </Button>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          iconOnly
                          aria-label="Delete"
                          title="Delete"
                          className="hover:text-danger"
                          onClick={() => void removeElectricityRecord(r.billPaymentId)}
                          disabled={electricityBusyId === r.billPaymentId}
                        >
                          <IconTrash size={13} />
                        </Button>
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
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (e.g. Electricity)"
              required
              maxLength={80}
              className="min-w-[10rem] flex-1"
            />
            <Select
              value={recurrence}
              onChange={(e) => {
                setRecurrence(e.target.value as BillRecurrence)
                setFormError('')
              }}
              className="w-auto"
            >
              <option value="MONTHLY">monthly</option>
              <option value="YEARLY">yearly</option>
              <option value="SCHEDULED">scheduled (specific dates)</option>
              <option value="NONE">no fixed date</option>
            </Select>
            <Select
              value={billType}
              onChange={(e) => setBillType(e.target.value as BillType)}
              className="w-auto"
            >
              <option value="FIXED">fixed</option>
              <option value="VARIABLE">variable</option>
            </Select>
            <Input
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              inputMode="decimal"
              placeholder="Expected amount"
              className="w-32"
            />
            {(recurrence === 'MONTHLY' || recurrence === 'YEARLY') && (
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-auto"
              />
            )}
            <CategoryPicker
              kind="EXPENSE"
              value={categoryId}
              onChange={setCategoryId}
              className="select w-auto"
            />
            <label className="flex items-center gap-1.5 text-sm text-muted">
              <input
                type="checkbox"
                checked={tracksElectricity}
                onChange={(e) => setTracksElectricity(e.target.checked)}
              />
              Track kWh
            </label>
            <Button type="submit" variant="primary">
              <IconPlus size={15} />
              Add bill
            </Button>
          </div>

          {recurrence === 'SCHEDULED' && (
            <div className="mt-3 border-t border-line pt-3">
              <p className="field-label">
                Dates (e.g. this term's tuition — add as many as you already know)
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="date"
                  value={scheduledInput}
                  onChange={(e) => setScheduledInput(e.target.value)}
                  className="w-auto"
                />
                <Button type="button" size="sm" onClick={addScheduledDraftDate}>
                  <IconPlus size={13} />
                  Add date
                </Button>
              </div>
              {scheduledDraft.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {scheduledDraft.map((d) => (
                    <li key={d} className="chip">
                      {new Date(d).toLocaleDateString()}
                      <button
                        type="button"
                        aria-label="Remove date"
                        onClick={() =>
                          setScheduledDraft((dates) => dates.filter((x) => x !== d))
                        }
                        className="ml-1 text-muted hover:text-danger"
                      >
                        <IconX size={11} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {recurrence === 'NONE' && (
            <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
              No due date needed — this bill can be paid any time, with no
              payability window. You'll still get a running payment history.
            </p>
          )}

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
