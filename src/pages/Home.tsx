import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSpace } from '../hooks/useSpace'
import { useMoney } from '../hooks/useMoney'
import { useStaggerIn } from '../lib/motion'
import { formatMoney } from '../domain/money'
import { Alert, Modal, Button, SkeletonCard, Skeleton } from '../components/ui'
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconClipboardCheck,
  IconWallet,
} from '../components/icons'
import QuickAdd from '../components/money/QuickAdd'
import ScanReceipt from '../components/money/ScanReceipt'
import AccountsCard from '../components/money/AccountsCard'
import CashCheck from '../components/money/CashCheck'
import TransactionList from '../components/money/TransactionList'

const greeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

/**
 * The headline card: total across active accounts, plus what came in and
 * went out this calendar month — in the Finance's own currency only, so
 * a foreign-currency account never gets silently added into a peso sum.
 */
const SummaryCard = ({ onCashCheck }: { onCashCheck?: () => void }) => {
  const { user } = useAuth()
  const { activeSpace } = useSpace()
  const { totalsByCurrency, transactions, accounts } = useMoney()
  const currency = activeSpace?.currency ?? 'PHP'

  const month = useMemo(() => {
    const now = new Date()
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    let spent = 0
    let received = 0
    for (const t of transactions) {
      if (t.currency !== currency || !t.occurredAt.startsWith(prefix)) continue
      if (t.type === 'EXPENSE') spent += t.amountMinor
      else if (t.type === 'INCOME') received += t.amountMinor
    }
    return { spent, received, label: now.toLocaleDateString(undefined, { month: 'long' }) }
  }, [transactions, currency])

  const otherTotals = Object.entries(totalsByCurrency).filter(([c]) => c !== currency)
  const activeCount = accounts.filter((a) => a.status === 'ACTIVE').length
  const roleNote =
    activeSpace && activeSpace.role !== 'OWNER' ? ` · ${activeSpace.role.toLowerCase()}` : ''

  return (
    <section className="hero-card" data-tour="summary">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted">
            {greeting()}, {user?.displayName || user?.username}
            {roleNote}
          </p>
          <h1 className="page-title truncate">{activeSpace ? activeSpace.name : 'Fico'}</h1>
        </div>
        {onCashCheck && (
          <Button onClick={onCashCheck} data-tour="cash-check">
            <IconClipboardCheck size={16} />
            Cash check
          </Button>
        )}
      </div>

      <div className="mt-5">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted">
          <IconWallet size={14} />
          Total balance · {activeCount} account{activeCount === 1 ? '' : 's'}
        </p>
        <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums text-ink sm:text-5xl">
          {formatMoney(totalsByCurrency[currency] ?? 0, currency)}
        </p>
        {otherTotals.length > 0 && (
          <p className="mt-1 text-sm text-muted tabular-nums">
            {otherTotals.map(([c, v]) => `+ ${formatMoney(v, c)}`).join('  ')}
          </p>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:max-w-md">
        <div className="stat-tile">
          <p className="flex items-center gap-1 text-xs text-muted">
            <IconArrowDownRight size={14} className="text-danger" />
            Spent in {month.label}
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">
            {formatMoney(month.spent, currency)}
          </p>
        </div>
        <div className="stat-tile">
          <p className="flex items-center gap-1 text-xs text-muted">
            <IconArrowUpRight size={14} className="text-success" />
            Received in {month.label}
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">
            {formatMoney(month.received, currency)}
          </p>
        </div>
      </div>
    </section>
  )
}

const Home = () => {
  const { error: spaceError } = useSpace()
  const { loading, error: moneyError, accounts } = useMoney()
  const [cashCheckOpen, setCashCheckOpen] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)
  useStaggerIn(gridRef, loading ? null : 'ready')

  const hasCashAccount = accounts.some(
    (a) => a.status === 'ACTIVE' && a.type === 'CASH',
  )

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="hero-card space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={3} />
        </div>
        <SkeletonCard lines={4} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {(spaceError || moneyError) && <Alert>{spaceError ?? moneyError}</Alert>}

      {/*
        One grid, three shapes:
        - phone: a single column, in reading order.
        - tablet (md): the summary and Accounts side by side, then Quick
          add, Scan and Records each across the full width.
        - laptop (lg+): a main column (summary, Quick add, Scan, Records)
          with Accounts as a sidebar on the right.
      */}
      <div
        ref={gridRef}
        className="grid items-start gap-4 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_21rem] xl:grid-cols-[minmax(0,1fr)_23rem]"
      >
        <div className="min-w-0 md:col-start-1 md:row-start-1">
          <SummaryCard onCashCheck={hasCashAccount ? () => setCashCheckOpen(true) : undefined} />
        </div>

        <aside className="min-w-0 md:col-start-2 md:row-start-1 lg:row-span-4">
          <AccountsCard />
        </aside>

        <div className="min-w-0 empty:hidden md:col-span-2 lg:col-span-1 lg:col-start-1">
          <QuickAdd />
        </div>

        <div className="min-w-0 md:col-span-2 lg:col-span-1 lg:col-start-1" data-tour="scan">
          <ScanReceipt />
        </div>

        <div className="min-w-0 md:col-span-2 lg:col-span-1 lg:col-start-1">
          <TransactionList />
        </div>
      </div>

      <p className="text-xs text-muted">
        Fico is a manual record — not connected to any bank or e-wallet.
        Numbers here may not exactly match your real balances.{' '}
        <Link to="/terms" className="underline">
          Learn more
        </Link>
      </p>

      {cashCheckOpen && (
        <Modal title="Cash check" onClose={() => setCashCheckOpen(false)}>
          <CashCheck />
        </Modal>
      )}
    </div>
  )
}

export default Home
