import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { celebrate } from '../features/ui/celebrate'
import { useBills } from '../hooks/useBills'
import { useMoney } from '../hooks/useMoney'
import { useAllTransactions } from '../hooks/useAllTransactions'
import { useAuth } from '../hooks/useAuth'
import { useSpace } from '../hooks/useSpace'
import { formatMoney, parseAmountToMinor } from '../domain/money'
import { compareElectricityPeriods, costPerKwhMinor } from '../domain/electricity'
import { formatUsage, periodLabel, recordKindOf, sumByPeriod, USAGE, USAGE_KINDS, usageKindOf, type UsageKind } from '../features/bills/usage'
import { billPayableFrom, isBillPayable } from '../features/bills'
import { getLastSeenAt, isUnseen, markSeenNow } from '../features/seen'
import { PageHeader, Button, Input, Select, Alert, SkeletonCard } from '../components/ui'
import {
  IconArchive,
  IconCalendar,
  IconChart,
  IconCheck,
  IconChevronDown,
  IconEdit,
  IconPlus,
  IconReceipt,
  IconRotateCcw,
  IconTrash,
  IconX,
} from '../components/icons'
import CategoryPicker from '../components/money/CategoryPicker'
import { gsap, prefersReducedMotion, scrollToAndHighlight } from '../lib/motion'
import CollapsibleCard from '../components/CollapsibleCard'
import Approx from '../components/Approx'
import { openSection } from '../lib/sections'
import { BarChart, EmptyChart } from '../components/charts'
import { monthlyInOut, shortMonth, startOfMonthIso } from '../domain/insights'
import type { Bill, BillPayment, BillRecurrence, BillType } from '../types/models'


/** "Track usage": none, or electricity (kWh), water (m³), LPG (kg), fuel (L). */
const UsagePicker = ({
  value,
  onChange,
  className = '',
}: {
  value: UsageKind | ''
  onChange: (kind: UsageKind | '') => void
  className?: string
}) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value as UsageKind | '')}
    aria-label="Track usage"
    title={value ? `e.g. ${USAGE[value].examples}` : 'Track how much you use, to see cost per unit'}
    className={`select ${className}`}
  >
    <option value="">No usage tracking</option>
    {USAGE_KINDS.map((k) => (
      <option key={k} value={k}>
        Track {USAGE[k].option}
      </option>
    ))}
  </select>
)

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
  const [usageKind, setUsageKind] = useState<UsageKind | ''>(usageKindOf(bill) ?? '')
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
        usageKind: usageKind || null,
        tracksElectricity: usageKind === 'ELECTRICITY',
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
        <UsagePicker value={usageKind} onChange={setUsageKind} className="w-auto" />
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

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000
const PAID_PREVIEW = 8
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

/**
 * One bill in Upcoming. Three states only: paid in the last 3 days (a
 * green "Paid" tag that jumps to the payment), payable now (the pay form),
 * or not open yet ("Opens <date>"). Nothing repeated here — the details
 * live in Paid bills.
 */
const UpcomingRow = ({
  bill,
  lastPayment,
  recentlyPaid,
  onJump,
}: {
  bill: Bill
  lastPayment: BillPayment | null
  recentlyPaid: boolean
  onJump: (paymentId: string) => void
}) => {
  const { payBill } = useBills()
  const { accounts, defaultAccount } = useMoney()
  const active = accounts.filter((a) => a.status === 'ACTIVE')

  const [amount, setAmount] = useState(
    bill.expectedAmountMinor != null ? String(bill.expectedAmountMinor / 100) : '',
  )
  const [accountId, setAccountId] = useState('')
  const [kwh, setKwh] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Paying far ahead of schedule made an already-paid bill look unpaid
  // (owner feedback) — so the form only appears once it's due soon or
  // overdue. NONE (bought whenever it runs out) is always payable.
  const nowIso = new Date().toISOString()
  const payable =
    bill.recurrence === 'NONE' ||
    (bill.nextDueDate != null && isBillPayable(bill.nextDueDate, nowIso))
  const overdue =
    bill.nextDueDate != null && bill.nextDueDate.slice(0, 10) < nowIso.slice(0, 10)

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
          usageKindOf(bill) && kwh.trim() !== ''
            ? { consumptionKwh: Number(kwh) || null }
            : null,
      })
      celebrate('bills.upcoming')
      setKwh('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record payment')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{bill.name}</p>
          <p className={`text-xs ${overdue && !recentlyPaid ? 'font-medium text-danger' : 'text-muted'}`}>
            {bill.recurrence === 'NONE'
              ? 'Any time'
              : bill.nextDueDate
                ? `${overdue && !recentlyPaid ? 'Overdue · was due' : 'Due'} ${shortDate(bill.nextDueDate)}`
                : 'Nothing scheduled'}
          </p>
        </div>

        {recentlyPaid && lastPayment ? (
          <button
            type="button"
            onClick={() => onJump(lastPayment.id)}
            title="See this payment in Paid bills"
            className="inline-flex items-center gap-1 rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success transition hover:bg-success/25 active:scale-95"
          >
            <IconCheck size={13} />
            Paid
          </button>
        ) : payable ? (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="Amount"
              aria-label={`Amount for ${bill.name}`}
              className="w-24"
            />
            <Select
              value={accountId || defaultAccount?.id || ''}
              onChange={(e) => setAccountId(e.target.value)}
              aria-label="Pay from"
              className="w-auto"
            >
              {active.length === 0 && <option value="">No accounts</option>}
              {active.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
            {usageKindOf(bill) && (
              <Input
                value={kwh}
                onChange={(e) => setKwh(e.target.value)}
                inputMode="decimal"
                placeholder={USAGE[usageKindOf(bill)!].unit}
                aria-label={USAGE[usageKindOf(bill)!].inputLabel}
                title={USAGE[usageKindOf(bill)!].inputLabel}
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
          </div>
        ) : (
          <span className="text-xs text-muted">
            {bill.nextDueDate
              ? `Opens ${shortDate(billPayableFrom(bill.nextDueDate))}`
              : 'Add a date in Edit'}
          </span>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </li>
  )
}

/** A bill's past payments, folded away — each one jumps to its full entry in Paid bills. */
const History = ({
  payments,
  onJump,
}: {
  payments: BillPayment[]
  onJump: (paymentId: string) => void
}) => {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1 text-xs font-medium text-muted hover:text-ink"
      >
        Payment history{payments.length > 0 && ` · ${payments.length}`}
        <IconChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {payments.length === 0 && <li className="text-xs text-muted">No payments yet.</li>}
          {payments.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onJump(p.id)}
                title="See this payment in Paid bills"
                className="chip transition hover:border-brand/50 hover:text-ink active:scale-95"
              >
                {shortDate(p.paidAt)} · {formatMoney(p.amountMinor)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Every bill payment in one place, newest first — the single home for
 * "what was paid, when, and from where" that Upcoming's "Paid" tag and
 * each bill's history jump to.
 */
const PaidBills = ({
  payments,
  billName,
  canEdit,
  lastSeenAt,
  currentUserId,
  expanded,
  onExpand,
}: {
  payments: BillPayment[]
  billName: (billId: string) => string
  canEdit: boolean
  lastSeenAt: string | null
  currentUserId: string | undefined
  expanded: boolean
  onExpand: () => void
}) => {
  const { deletePayment, electricity } = useBills()
  const { accounts } = useMoney()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const kwhByPayment = useMemo(
    () =>
      new Map(
        electricity
          .filter((r) => r.consumptionKwh != null)
          .map((r) => [r.billPaymentId, formatUsage(r.consumptionKwh!, recordKindOf(r))]),
      ),
    [electricity],
  )
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? 'an account'
  const shown = expanded ? payments : payments.slice(0, PAID_PREVIEW)

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete payment')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <CollapsibleCard
      id="bills.paid"
      title="Paid bills"
      icon={IconCheck}
      dataTour="bills-paid"
      subtitle={`${payments.length} payment${payments.length === 1 ? '' : 's'}`}
    >
      {error && <p className="mb-2 text-xs text-danger">{error}</p>}
      {payments.length === 0 ? (
        <p className="text-sm text-muted">Payments you record show up here.</p>
      ) : (
        <ul className="-mt-2 divide-y divide-line">
          {shown.map((p) => {
            const unseen = isUnseen(p.createdAt, p.createdBy, lastSeenAt, currentUserId)
            const kwh = kwhByPayment.get(p.id)
            return (
              <li
                key={p.id}
                id={`payment-${p.id}`}
                className="-mx-2 flex items-center justify-between gap-3 px-2 py-2.5"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium text-ink">
                    {unseen && (
                      <span
                        aria-label="New, not yet seen"
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger"
                      />
                    )}
                    {billName(p.billId)}
                  </p>
                  <p className="text-xs text-muted">
                    {new Date(p.paidAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                    {' · from '}
                    {accountName(p.accountId)}
                    {kwh != null && ` · ${kwh}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="mr-1 text-sm font-semibold tabular-nums text-ink">
                    {formatMoney(p.amountMinor)}
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
                      <IconTrash size={14} />
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {!expanded && payments.length > PAID_PREVIEW && (
        <button
          type="button"
          onClick={onExpand}
          className="mt-2 text-xs font-medium text-brand hover:underline"
        >
          Show all {payments.length} payments
        </button>
      )}
    </CollapsibleCard>
  )
}

/**
 * Side-panel overview: what's due soon, what's been paid this month, and
 * six months of bill spending (every BILL_PAYMENT expense, by month).
 */
const BillsOverview = ({ bills }: { bills: Bill[] }) => {
  const transactions = useAllTransactions()
  const { activeSpace } = useSpace()
  const currency = activeSpace?.currency ?? 'PHP'

  const stats = useMemo(() => {
    const now = new Date()
    const todayIso = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString()
    const in30 = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 30)).toISOString()
    const active = bills.filter((b) => b.active)
    const dueSoon = active.filter((b) => b.nextDueDate && b.nextDueDate >= todayIso && b.nextDueDate <= in30)
    const overdue = active.filter((b) => b.nextDueDate && b.nextDueDate < todayIso)
    const monthStart = startOfMonthIso()
    const paidThisMonth = transactions
      .filter((t) => t.sourceType === 'BILL_PAYMENT' && t.currency === currency && t.occurredAt >= monthStart)
      .reduce((sum, t) => sum + t.amountMinor, 0)
    return {
      dueSoonCount: dueSoon.length,
      dueSoonMinor: dueSoon.reduce((sum, b) => sum + (b.expectedAmountMinor ?? 0), 0),
      overdueCount: overdue.length,
      paidThisMonth,
    }
  }, [bills, transactions, currency])

  const monthly = useMemo(() => {
    const billTxns = transactions.filter((t) => t.sourceType === 'BILL_PAYMENT')
    return monthlyInOut(billTxns, 6, currency).map((m) => ({ ...m, values: [m.values[1]] }))
  }, [transactions, currency])
  const hasHistory = monthly.some((m) => m.values[0] > 0)

  return (
    <CollapsibleCard id="bills.overview" title="Overview" icon={IconChart} dataTour="bills-overview">
      <div className="grid grid-cols-2 gap-2">
        <div className="stat-tile">
          <p className="text-xs text-muted">Due in 30 days · {stats.dueSoonCount}</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">
            {formatMoney(stats.dueSoonMinor, currency)}
          </p>
          <Approx minor={stats.dueSoonMinor} currency={currency} />
        </div>
        <div className="stat-tile">
          <p className="text-xs text-muted">Paid this month</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">
            {formatMoney(stats.paidThisMonth, currency)}
          </p>
          <Approx minor={stats.paidThisMonth} currency={currency} />
        </div>
      </div>
      {stats.overdueCount > 0 && (
        <p className="mt-2 rounded-lg bg-danger/10 px-3 py-1.5 text-xs font-medium text-danger">
          {stats.overdueCount} bill{stats.overdueCount === 1 ? ' is' : 's are'} overdue
        </p>
      )}
      <p className="mt-4 text-xs font-medium text-muted">Bill payments · last 6 months</p>
      <div className="mt-2">
        {hasHistory ? (
          <BarChart
            ariaLabel="Bill payments per month for the last six months"
            data={monthly}
            series={[{ name: 'Paid', color: 'var(--brand)' }]}
            currency={currency}
            height={150}
          />
        ) : (
          <EmptyChart>Payments you record show up here month by month.</EmptyChart>
        )}
      </div>
    </CollapsibleCard>
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
    updateBill,
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
  const [paidExpanded, setPaidExpanded] = useState(false)
  const [adding, setAdding] = useState(false)
  const addFormRef = useRef<HTMLFormElement>(null)
  // The add form slides open under the "Add bill" button.
  useLayoutEffect(() => {
    const el = addFormRef.current
    if (!adding || !el || prefersReducedMotion()) return
    const tween = gsap.fromTo(
      el,
      { height: 0, autoAlpha: 0, overflow: 'hidden' },
      { height: 'auto', autoAlpha: 1, duration: 0.4, ease: 'power3.out', clearProps: 'height,opacity,visibility,overflow' },
    )
    return () => {
      tween.kill()
    }
  }, [adding])
  const [pendingJump, setPendingJump] = useState<string | null>(null)
  const { paymentsFor } = useBills()

  // Every payment on every bill (active and archived), newest first —
  // reloaded whenever the bills reload, which is exactly what paying or
  // deleting a payment triggers.
  const [payments, setPayments] = useState<BillPayment[]>([])
  useEffect(() => {
    let cancelled = false
    void Promise.all(bills.map((b) => paymentsFor(b.id))).then((lists) => {
      if (cancelled) return
      setPayments(
        lists
          .flat()
          .filter((p) => !p.deletedAt)
          .sort((a, b) => b.paidAt.localeCompare(a.paidAt)),
      )
    })
    return () => {
      cancelled = true
    }
    // paymentsFor is a fresh function each render; bills is the real signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bills])

  const paymentsByBill = useMemo(() => {
    const map = new Map<string, BillPayment[]>()
    for (const p of payments) map.set(p.billId, [...(map.get(p.billId) ?? []), p])
    return map
  }, [payments])

  const billName = (billId: string) =>
    bills.find((b) => b.id === billId)?.name ?? deletedBills.find((b) => b.id === billId)?.name ?? 'Deleted bill'

  /** Scroll to a payment in Paid bills and flash it (expanding the list first if it's further down). */
  const jumpToPayment = (paymentId: string) => {
    const index = payments.findIndex((p) => p.id === paymentId)
    if (index >= PAID_PREVIEW && !paidExpanded) setPaidExpanded(true)
    openSection('bills.paid')
    setPendingJump(paymentId)
  }
  useEffect(() => {
    if (!pendingJump) return
    // Next frame: the Paid bills card may have just been unfolded.
    const id = pendingJump
    requestAnimationFrame(() => {
      const el = document.getElementById(`payment-${id}`)
      if (el) scrollToAndHighlight(el)
    })
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingJump(null)
  }, [pendingJump, paidExpanded])

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
  const [usageKind, setUsageKind] = useState<UsageKind | ''>('')
  const [categoryId, setCategoryId] = useState(
    () => categories.find((c) => c.name === 'Bills')?.id ?? '',
  )
  const [formError, setFormError] = useState('')

  const horizon = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 45)
    return d.toISOString()
  }, [])

  // Upcoming (owner feedback): a bill that's already paid for this cycle
  // leaves the list — except for 3 days after paying, when it stays with a
  // "Paid" tag so the payment visibly landed. Payable and overdue bills
  // always show; a not-yet-payable one only if this cycle isn't paid yet.
  // No-due-date bills (bought whenever it runs out) go at the bottom.
  const [openedAt] = useState(() => Date.now())
  const upcoming = useMemo(() => {
    const nowIso = new Date(openedAt).toISOString()
    const rows = bills
      .filter((b) => b.active)
      .map((bill) => {
        const last = paymentsByBill.get(bill.id)?.[0] ?? null
        const recentlyPaid = last != null && openedAt - Date.parse(last.paidAt) <= THREE_DAYS_MS
        return { bill, last, recentlyPaid }
      })
      .filter(({ bill, last, recentlyPaid }) => {
        if (recentlyPaid || bill.recurrence === 'NONE') return true
        if (!bill.nextDueDate || bill.nextDueDate > horizon) return false
        if (isBillPayable(bill.nextDueDate, nowIso)) return true
        // Not open for payment yet: hide it if this cycle is already paid.
        const cycleDays = bill.recurrence === 'YEARLY' ? 370 : 35
        const cycleStart = Date.parse(bill.nextDueDate) - cycleDays * 86_400_000
        return !(last && Date.parse(last.paidAt) >= cycleStart)
      })
    return rows.sort((a, b) => {
      const aNone = a.bill.recurrence === 'NONE' ? 1 : 0
      const bNone = b.bill.recurrence === 'NONE' ? 1 : 0
      if (aNone !== bNone) return aNone - bNone
      return (a.bill.nextDueDate ?? '').localeCompare(b.bill.nextDueDate ?? '')
    })
  }, [bills, paymentsByBill, horizon, openedAt])
  const active = bills.filter((b) => b.active)
  // Archived = `active: false` — kept with its full payment history, just
  // out of Upcoming, All bills, reminders and the budget until restored.
  const archived = bills.filter((b) => !b.active)

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
        usageKind: usageKind || null,
        tracksElectricity: usageKind === 'ELECTRICITY',
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
      setUsageKind('')
      setAdding(false)
      celebrate('bills.all')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create bill')
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="space-y-4">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={4} />
        </div>
        <SkeletonCard lines={5} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        icon={IconReceipt}
        title="Bills"
        description="Due dates, reminders and every payment in one place."
      />
      {error && <Alert>{error}</Alert>}

      {/* Bills and their charts on the left; the long Paid bills list on
          the right on a wide screen (below everything on a phone). Every
          card folds away by tapping its name. */}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_27rem]">
        <div className="min-w-0 space-y-4">
          <CollapsibleCard
            id="bills.upcoming"
            title="Upcoming"
            icon={IconCalendar}
            dataTour="bills-upcoming"
            subtitle={upcoming.length > 0 ? `${upcoming.length} to pay` : 'all caught up'}
          >
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted">Nothing to pay right now — you're all caught up.</p>
            ) : (
              <ul className="-mt-2 divide-y divide-line">
                {upcoming.map(({ bill, last, recentlyPaid }) => (
                  <UpcomingRow
                    key={bill.id}
                    bill={bill}
                    lastPayment={last}
                    recentlyPaid={recentlyPaid}
                    onJump={jumpToPayment}
                  />
                ))}
              </ul>
            )}
          </CollapsibleCard>

          <CollapsibleCard
            id="bills.all"
            title="All bills"
            icon={IconReceipt}
            dataTour="bills-all"
            subtitle={`${active.length} bill${active.length === 1 ? '' : 's'}`}
            actions={
              canEdit && (
                <Button
                  size="sm"
                  variant={adding ? 'default' : 'primary'}
                  onClick={() => setAdding((v) => !v)}
                  data-tour="bills-add"
                >
                  {adding ? <IconX size={14} /> : <IconPlus size={14} />}
                  {adding ? 'Cancel' : 'Add bill'}
                </Button>
              )
            }
          >
            {canEdit && adding && (
              <form
                ref={addFormRef}
                onSubmit={submit}
                className="mb-3 space-y-2 rounded-xl border border-line bg-panel-2 p-3"
              >
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name (e.g. Electricity)"
                  required
                  maxLength={80}
                  autoFocus
                />
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={recurrence}
                    onChange={(e) => {
                      setRecurrence(e.target.value as BillRecurrence)
                      setFormError('')
                    }}
                    aria-label="How often"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                    <option value="SCHEDULED">Specific dates</option>
                    <option value="NONE">No fixed date</option>
                  </Select>
                  <Select
                    value={billType}
                    onChange={(e) => setBillType(e.target.value as BillType)}
                    aria-label="Amount type"
                  >
                    <option value="FIXED">Same amount</option>
                    <option value="VARIABLE">Amount changes</option>
                  </Select>
                </div>
                <div className={`grid gap-2 ${recurrence === 'MONTHLY' || recurrence === 'YEARLY' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <Input
                    value={expected}
                    onChange={(e) => setExpected(e.target.value)}
                    inputMode="decimal"
                    placeholder="Expected amount"
                  />
                  {(recurrence === 'MONTHLY' || recurrence === 'YEARLY') && (
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      aria-label="Next due date"
                    />
                  )}
                </div>

                {recurrence === 'SCHEDULED' && (
                  <div>
                    <p className="field-label">
                      Dates (e.g. this term's tuition — add as many as you already know)
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={scheduledInput}
                        onChange={(e) => setScheduledInput(e.target.value)}
                      />
                      <Button type="button" onClick={addScheduledDraftDate}>
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
                  <p className="text-xs text-muted">
                    No due date needed — pay it any time; you still get a running payment history.
                  </p>
                )}

                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <CategoryPicker
                    kind="EXPENSE"
                    value={categoryId}
                    onChange={setCategoryId}
                    className="select w-full"
                  />
                  <UsagePicker value={usageKind} onChange={setUsageKind} className="w-full" />
                </div>

                {formError && (
                  <p role="alert" className="text-xs text-danger">
                    {formError}
                  </p>
                )}
                <Button type="submit" variant="primary" className="w-full">
                  <IconPlus size={15} />
                  Add bill
                </Button>
              </form>
            )}

            <ul className="-mt-2 divide-y divide-line">
              {active.map((bill, billIndex) => {
                const billUnseen = isUnseen(bill.createdAt, bill.createdBy, lastSeenAt, user?.id)
                return (
                  <li key={bill.id} className={`py-3 ${billUnseen ? 'bg-danger/5' : ''}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate text-sm font-medium text-ink">
                          {billUnseen && (
                            <span
                              aria-label="New, not yet seen"
                              className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger"
                            />
                          )}
                          {bill.name}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {RECURRENCE_LABEL[bill.recurrence]}
                          {bill.nextDueDate && ` · next ${shortDate(bill.nextDueDate)}`}
                          {bill.expectedAmountMinor != null &&
                            ` · ~${formatMoney(bill.expectedAmountMinor)}`}
                          {bill.categoryName && ` · ${bill.categoryName}`}
                        </p>
                      </div>
                      <span
                        className="flex shrink-0 items-center gap-1"
                        data-tour={billIndex === 0 ? 'bill-actions' : undefined}
                      >
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            iconOnly
                            aria-label="Edit bill"
                            title="Edit bill (name, dates, category)"
                            onClick={() => setEditingId((id) => (id === bill.id ? null : bill.id))}
                          >
                            <IconEdit size={14} />
                          </Button>
                        )}
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            iconOnly
                            aria-label="Archive bill"
                            title="Archive bill"
                            onClick={() => {
                              if (editingId === bill.id) setEditingId(null)
                              void updateBill(bill.id, { active: false })
                            }}
                          >
                            <IconArchive size={14} />
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
                                  `Delete "${bill.name}"? This removes the whole bill, not just one payment — its payment history stays and it can be restored later. To fix one wrong payment, delete it in Paid bills instead.`,
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
                      <EditBillForm bill={bill} onDone={() => setEditingId(null)} />
                    ) : (
                      <History payments={paymentsByBill.get(bill.id) ?? []} onJump={jumpToPayment} />
                    )}
                  </li>
                )
              })}
              {active.length === 0 && (
                <li className="py-3 text-sm text-muted">
                  No bills yet{canEdit ? ' — tap “Add bill” to start.' : '.'}
                </li>
              )}
            </ul>
          </CollapsibleCard>


          {archived.length > 0 && (
            <CollapsibleCard
              id="bills.archived"
              title="Archived bills"
              icon={IconArchive}
              subtitle={`${archived.length}`}
            >
              <p className="text-xs text-muted">
                Archived bills don't show as upcoming or count toward your budget. Restore one to
                start tracking it again — its payment history is kept.
              </p>
              <ul className="mt-1 divide-y divide-line">
                {archived.map((bill) => (
                  <li key={bill.id} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-muted">{bill.name}</p>
                        <p className="text-xs text-muted">
                          {RECURRENCE_LABEL[bill.recurrence]}
                          {bill.expectedAmountMinor != null && ` · ~${formatMoney(bill.expectedAmountMinor)}`}
                        </p>
                      </div>
                      {canEdit && (
                        <Button
                          size="sm"
                          disabled={restoringId === bill.id}
                          onClick={async () => {
                            setRestoringId(bill.id)
                            try {
                              await updateBill(bill.id, { active: true })
                            } finally {
                              setRestoringId(null)
                            }
                          }}
                        >
                          <IconRotateCcw size={14} />
                          {restoringId === bill.id ? 'Restoring…' : 'Restore'}
                        </Button>
                      )}
                    </div>
                    <History payments={paymentsByBill.get(bill.id) ?? []} onJump={jumpToPayment} />
                  </li>
                ))}
              </ul>
            </CollapsibleCard>
          )}

          {canEdit && deletedBills.length > 0 && (
            <CollapsibleCard
              id="bills.deleted"
              title="Deleted bills"
              icon={IconTrash}
              subtitle={`${deletedBills.length}`}
            >
              <p className="text-xs text-muted">
                Deleted by mistake? Restore brings it back as active, exactly as it was — its
                payment history comes with it.
              </p>
              <ul className="mt-1 divide-y divide-line">
                {deletedBills.map((bill) => (
                  <li key={bill.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{bill.name}</p>
                      <p className="text-xs text-muted">
                        {bill.recurrence === 'NONE' || !bill.nextDueDate
                          ? dueDateLabel(bill)
                          : `was due ${dueDateLabel(bill)}`}
                      </p>
                    </div>
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
            </CollapsibleCard>
          )}
        </div>

        {/* Totals and usage sit above the Paid bills list. */}
        <aside className="min-w-0 space-y-4">
          <BillsOverview bills={bills} />

          {USAGE_KINDS.filter(
            // Only for someone actually paying this kind of bill, once there's a reading.
            (kind) => electricity.some((r) => recordKindOf(r) === kind) && bills.some((b) => usageKindOf(b) === kind),
          ).map((kind, index) => {
            const recs = electricity.filter((r) => recordKindOf(r) === kind)
            const info = USAGE[kind]
            const monthly = sumByPeriod(recs)
            const trend = compareElectricityPeriods(monthly)
            const latest = trend[trend.length - 1]
            const used = trend.filter((t) => t.consumptionKwh != null)
            const avgUse = used.length ? used.reduce((n, t) => n + (t.consumptionKwh ?? 0), 0) / used.length : null
            return (
            <CollapsibleCard
              key={kind}
              id={kind === 'ELECTRICITY' ? 'bills.electricity' : `bills.usage.${kind.toLowerCase()}`}
              title={info.label}
              icon={IconChart}
              dataTour={index === 0 ? 'bills-electricity' : undefined}
            >
              {latest && (
                <div className="mb-3 grid grid-cols-3 gap-2">
                  <div className="stat-tile">
                    <p className="text-[11px] text-muted">Last bill</p>
                    <p className="text-sm font-semibold tabular-nums text-ink">{formatMoney(latest.amountMinor)}</p>
                    {latest.amountVsPriorPct != null && (
                      <p className={`text-[11px] tabular-nums ${latest.amountVsPriorPct > 0 ? 'text-danger' : 'text-success'}`}>
                        {latest.amountVsPriorPct > 0 ? '▲' : '▼'} {Math.abs(latest.amountVsPriorPct).toFixed(0)}% vs before
                      </p>
                    )}
                  </div>
                  <div className="stat-tile">
                    <p className="text-[11px] text-muted">Used</p>
                    <p className="text-sm font-semibold tabular-nums text-ink">
                      {latest.consumptionKwh != null ? formatUsage(latest.consumptionKwh, kind) : '—'}
                    </p>
                    {latest.kwhVsPriorPct != null && (
                      <p className={`text-[11px] tabular-nums ${latest.kwhVsPriorPct > 0 ? 'text-danger' : 'text-success'}`}>
                        {latest.kwhVsPriorPct > 0 ? '▲' : '▼'} {Math.abs(latest.kwhVsPriorPct).toFixed(0)}% vs before
                      </p>
                    )}
                  </div>
                  <div className="stat-tile">
                    <p className="text-[11px] text-muted">Avg use</p>
                    <p className="text-sm font-semibold tabular-nums text-ink">
                      {avgUse != null ? formatUsage(Math.round(avgUse * 10) / 10, kind) : '—'}
                    </p>
                    {latest.costPerKwhMinor != null && (
                      <p className="text-[11px] tabular-nums text-muted">
                        {formatMoney(latest.costPerKwhMinor)}
                        {info.perUnit} now
                      </p>
                    )}
                  </div>
                </div>
              )}
              <div className="grid gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted">Cost per billing period</p>
                  <div className="mt-2">
                    <BarChart
                      ariaLabel={`${info.label} cost per billing period`}
                      data={monthly
                        .slice(-6)
                        .map((r) => ({
                          key: r.billingPeriod,
                          label: r.billingPeriod.length === 7 ? shortMonth(r.billingPeriod) : r.billingPeriod.slice(5),
                          title: `${r.billingPeriod}${r.consumptionKwh != null ? ` · ${formatUsage(r.consumptionKwh, kind)}` : ''}`,
                          values: [r.amountMinor],
                        }))}
                      series={[{ name: 'Cost', color: 'var(--brand)' }]}
                      height={150}
                    />
                  </div>
                </div>
                <div className="min-w-0">
                  {electricityError && (
                    <p role="alert" className="mb-1 text-xs text-danger">
                      {electricityError}
                    </p>
                  )}
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted">
                      <tr>
                        <th className="py-1">Period</th>
                        <th className="py-1 text-right">Amount</th>
                        <th className="py-1 text-right">{info.unit}</th>
                        <th className="py-1 text-right">₱{info.perUnit}</th>
                        {canEdit && <th className="py-1" />}
                      </tr>
                    </thead>
                    <tbody>
                      {recs.map((r) => {
                        const perKwh = costPerKwhMinor(r.amountMinor, r.consumptionKwh)
                        return (
                          <tr key={r.id} className="border-t">
                            <td className="py-1.5">{periodLabel(r.billingPeriod)}</td>
                            <td className="py-1.5 text-right tabular-nums">{formatMoney(r.amountMinor)}</td>
                            <td className="py-1.5 text-right tabular-nums">{r.consumptionKwh ?? '—'}</td>
                            <td className="py-1.5 text-right tabular-nums">
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
                </div>
              </div>
            </CollapsibleCard>
            )
          })}

          <PaidBills
            payments={payments}
            billName={billName}
            canEdit={canEdit}
            lastSeenAt={lastSeenAt}
            currentUserId={user?.id}
            expanded={paidExpanded}
            onExpand={() => setPaidExpanded(true)}
          />
        </aside>
      </div>
    </div>
  )
}

export default Bills
