import { useAuth } from '../hooks/useAuth'
import { useSpace } from '../hooks/useSpace'
import { useMoney } from '../hooks/useMoney'
import QuickAdd from '../components/money/QuickAdd'
import AccountsCard from '../components/money/AccountsCard'
import CashCheck from '../components/money/CashCheck'
import AddTransactionForm from '../components/money/AddTransactionForm'
import TransactionList from '../components/money/TransactionList'

const Home = () => {
  const { user } = useAuth()
  const { activeSpace, error: spaceError } = useSpace()
  const { loading, error: moneyError } = useMoney()

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">
          {activeSpace ? activeSpace.name : 'Fico'}
        </h1>
        <p className="text-sm text-gray-600">
          Hello, {user?.displayName || user?.username}
          {activeSpace && activeSpace.role !== 'OWNER'
            ? ` · ${activeSpace.role.toLowerCase()}`
            : ''}
        </p>
      </div>

      {(spaceError || moneyError) && (
        <p role="alert" className="text-sm text-red-600">
          {spaceError ?? moneyError}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <>
          <QuickAdd />
          <AccountsCard />
          <CashCheck />
          <TransactionList />
          <details className="rounded border p-4">
            <summary className="cursor-pointer text-sm text-gray-600">
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
