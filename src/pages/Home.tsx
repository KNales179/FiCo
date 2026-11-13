import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSpace } from '../hooks/useSpace'
import { useMoney } from '../hooks/useMoney'
import { useAllTransactions } from '../hooks/useAllTransactions'
import { useStaggerIn } from '../lib/motion'
import { formatMoney } from '../domain/money'
import { Alert, Modal, Button, SkeletonCard, Skeleton } from '../components/ui'
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconChart,
  IconClipboardCheck,
  IconStar,
  IconWallet,
} from '../components/icons'
import { PinMenu } from '../components/money/PinnedBalance'
import { loadPinned, savePinned, type PinnedChoice } from '../features/dashboard/pinnedBalance'
import { BarChart, EmptyChart, RankedBars } from '../components/charts'
import { dailySpending, spendingByCategory, startOfMonthIso } from '../domain/insights'
import { RECEIPT_SCAN_ENABLED } from '../features/receipts/flags'
import CollapsibleCard from '../components/CollapsibleCard'
import Approx from '../components/Approx'
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
  const { totalsByCurrency, accounts } = useMoney()
  const transactions = useAllTransactions()
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

  // A balance this person pinned to see first (next to the Total, or instead of it).
  const spaceId = activeSpace?.id ?? null
  const [pinState, setPinState] = useState<{ spaceId: string | null; choice: PinnedChoice | null }>(() => ({
    spaceId,
    choice: loadPinned(spaceId),
  }))
  const pinChoice = pinState.spaceId === spaceId ? pinState.choice : loadPinned(spaceId)
  const choosePin = (choice: PinnedChoice | null) => {
    if (!spaceId) return
    savePinned(spaceId, choice)
    setPinState({ spaceId, choice })
  }
  // Archived or deleted since? Quietly back to just the Total.
  const pinned = pinChoice ? accounts.find((a) => a.id === pinChoice.accountId && a.status === 'ACTIVE') ?? null : null
  const pinMode = pinChoice?.mode ?? 'beside'

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

      <div className="mt-5 flex flex-col gap-4">
        {pinned && (
          <div className={pinMode === 'beside' ? 'order-2 border-t border-line/70 pt-3' : ''}>
            <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted">
              <IconStar size={14} className="text-brand" />
              {pinned.name}
              <PinMenu accounts={accounts} current={pinChoice} onChange={choosePin} />
            </p>
            <p
              className={`mt-1 font-bold tracking-tight tabular-nums text-ink ${
                pinMode === 'beside' ? 'text-3xl sm:text-4xl' : 'text-4xl sm:text-5xl'
              }`}
            >
              {formatMoney(pinned.balanceMinor, pinned.currency)}
            </p>
            <Approx minor={pinned.balanceMinor} currency={pinned.currency} className="mt-0.5 text-sm" />
          </div>
        )}

        {(!pinned || pinMode === 'beside') && (
          <div className={pinned ? 'order-1' : ''}>
            <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted">
              <IconWallet size={14} />
              Total balance · {activeCount} account{activeCount === 1 ? '' : 's'}
              {!pinned && <PinMenu accounts={accounts} current={null} onChange={choosePin} />}
            </p>
            <p
              className={`mt-1 font-bold tracking-tight tabular-nums text-ink ${
                pinned ? 'text-3xl sm:text-4xl' : 'text-4xl sm:text-5xl'
              }`}
            >
              {formatMoney(totalsByCurrency[currency] ?? 0, currency)}
            </p>
            <Approx minor={totalsByCurrency[currency] ?? 0} currency={currency} className="mt-0.5 text-sm" />
            {otherTotals.length > 0 && (
              <p className="mt-1 text-sm text-muted tabular-nums">
                {otherTotals.map(([c, v]) => `+ ${formatMoney(v, c)}`).join('  ')}
              </p>
            )}
          </div>
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
          <Approx minor={month.spent} currency={currency} />
        </div>
        <div className="stat-tile">
          <p className="flex items-center gap-1 text-xs text-muted">
            <IconArrowUpRight size={14} className="text-success" />
            Received in {month.label}
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">
            {formatMoney(month.received, currency)}
          </p>
          <Approx minor={month.received} currency={currency} />
        </div>
      </div>
    </section>
  )
}

/**
 * The dashboard's charts: daily spending over the last two weeks, and where
 * this month's money went. Same currency rule as the summary card.
 */
const InsightsCard = () => {
  const { activeSpace } = useSpace()
  const transactions = useAllTransactions()
  const currency = activeSpace?.currency ?? 'PHP'
  const daily = useMemo(() => dailySpending(transactions, 14, currency), [transactions, currency])
  const categories = useMemo(
    () => spendingByCategory(transactions, startOfMonthIso(), currency),
    [transactions, currency],
  )
  const hasDaily = daily.some((d) => d.value > 0)

  return (
    <CollapsibleCard id="dash.insights" title="Insights" icon={IconChart} dataTour="insights">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">Spending · last 14 days</p>
          <div className="mt-2">
            {hasDaily ? (
              <BarChart
                ariaLabel="Spending per day for the last 14 days"
                data={daily.map((d) => ({ key: d.key, label: d.label, title: d.title, values: [d.value] }))}
                series={[{ name: 'Spent', color: 'var(--brand)' }]}
                currency={currency}
                height={170}
              />
            ) : (
              <EmptyChart>No spending recorded in the last 14 days.</EmptyChart>
            )}
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">Top categories · this month</p>
          <div className="mt-3">
            {categories.length > 0 ? (
              <RankedBars rows={categories} currency={currency} max={5} />
            ) : (
              <EmptyChart>Nothing spent yet this month.</EmptyChart>
            )}
          </div>
        </div>
      </div>
    </CollapsibleCard>
  )
}

const Home = () => {
  const { error: spaceError } = useSpace()
  const { loading, error: moneyError, accounts } = useMoney()
  const [cashCheckOpen, setCashCheckOpen] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)
  useStaggerIn(gridRef, loading ? null : 'ready', { selector: ':scope > aside > *, :scope > div > *' })

  const hasCashAccount = accounts.some(
    (a) => a.status === 'ACTIVE' && a.type === 'CASH',
  )

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-[24rem_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="hero-card space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-10 w-48" />
          </div>
          <SkeletonCard lines={3} />
        </div>
        <div className="space-y-4">
          <SkeletonCard lines={5} />
          <SkeletonCard lines={6} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {(spaceError || moneyError) && <Alert>{spaceError ?? moneyError}</Alert>}

      {/*
        Three shapes from one grid:
        - phone: one column — summary, Quick add, Accounts, Insights, Records.
        - tablet (md): summary and Accounts side by side, Quick add under
          them, then Insights and Records across the full width.
        - laptop (lg+): a left column (summary, Quick add, Accounts) that
          stays put — scrolling on its own if it's taller than the screen —
          while the right column (Insights, Records) scrolls with the page.
      */}
      <div
        ref={gridRef}
        className="grid items-start gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]"
      >
        <aside
          data-scroll-panel
          className="grid min-w-0 gap-4 md:grid-cols-2 lg:sticky lg:top-[calc(var(--header-h,6rem)+1rem)] lg:max-h-[calc(100dvh-var(--header-h,6rem)-2rem)] lg:grid-cols-1 lg:-m-1.5 lg:overflow-y-auto lg:overscroll-contain lg:p-1.5 lg:[scrollbar-width:thin]"
        >
          <div className="min-w-0 md:col-start-1 md:row-start-1 lg:row-auto">
            <SummaryCard onCashCheck={hasCashAccount ? () => setCashCheckOpen(true) : undefined} />
          </div>
          <div className="min-w-0 empty:hidden md:col-span-2 md:row-start-2 lg:col-span-1 lg:row-auto">
            <QuickAdd />
          </div>
          <div className="min-w-0 md:col-start-2 md:row-start-1 lg:col-start-1 lg:row-auto">
            <AccountsCard />
          </div>
          {RECEIPT_SCAN_ENABLED && (
            <div className="min-w-0 md:col-span-2 lg:col-span-1" data-tour="scan">
              <ScanReceipt />
            </div>
          )}
          <p className="text-xs text-muted md:col-span-2 lg:col-span-1">
            Fico is a manual record — not connected to any bank or e-wallet.
            Numbers here may not exactly match your real balances.{' '}
            <Link to="/terms" className="underline">
              Learn more
            </Link>
          </p>
        </aside>

        <div className="grid min-w-0 gap-4">
          <InsightsCard />
          <TransactionList />
        </div>
      </div>

      {cashCheckOpen && (
        <Modal title="Cash check" onClose={() => setCashCheckOpen(false)}>
          <CashCheck />
        </Modal>
      )}
    </div>
  )
}

export default Home
