import { useAuth } from '../hooks/useAuth'
import { useSpace } from '../hooks/useSpace'
import { useMoney } from '../hooks/useMoney'
import { PageHeader, Alert } from '../components/ui'
import QuickAdd from '../components/money/QuickAdd'
import ScanReceipt from '../components/money/ScanReceipt'
import AccountsCard from '../components/money/AccountsCard'
import CashCheck from '../components/money/CashCheck'
import AddTransactionForm from '../components/money/AddTransactionForm'
import TransactionList from '../components/money/TransactionList'

const Home = () => {
  const { user } = useAuth()
  const { activeSpace, error: spaceError } = useSpace()
  const { loading, error: moneyError } = useMoney()

  const roleNote =
    activeSpace && activeSpace.role !== 'OWNER'
      ? ` · ${activeSpace.role.toLowerCase()}`
      : ''

  return (
    <div className="space-y-4">
      <PageHeader
        title={activeSpace ? activeSpace.name : 'Fico'}
        description={`Hello, ${user?.displayName || user?.username}${roleNote}`}
      />

      {(spaceError || moneyError) && <Alert>{spaceError ?? moneyError}</Alert>}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <QuickAdd />
          <ScanReceipt />
          <AccountsCard />
          <CashCheck />
          <TransactionList />
          <details className="card">
            <summary className="cursor-pointer text-sm text-muted">
              Transfer or detailed entry
            </summary>
            <div className="mt-3">
              <AddTransactionForm />
            </div>
          </details>
        </>
      )}
    </div>
  )
}

export default Home
