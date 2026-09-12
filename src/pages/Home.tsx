import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useSpace } from '../hooks/useSpace'
import { useMoney } from '../hooks/useMoney'
import { PageHeader, Alert, Modal } from '../components/ui'
import QuickAdd from '../components/money/QuickAdd'
import ScanReceipt from '../components/money/ScanReceipt'
import AccountsCard from '../components/money/AccountsCard'
import CashCheck from '../components/money/CashCheck'
import TransactionList from '../components/money/TransactionList'

const Home = () => {
  const { user } = useAuth()
  const { activeSpace, error: spaceError } = useSpace()
  const { loading, error: moneyError, accounts } = useMoney()
  const [cashCheckOpen, setCashCheckOpen] = useState(false)

  const roleNote =
    activeSpace && activeSpace.role !== 'OWNER'
      ? ` · ${activeSpace.role.toLowerCase()}`
      : ''

  const hasCashAccount = accounts.some(
    (a) => a.status === 'ACTIVE' && a.type === 'CASH',
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title={activeSpace ? activeSpace.name : 'Fico'}
        description={`Hello, ${user?.displayName || user?.username}${roleNote}`}
        actions={
          hasCashAccount ? (
            <button
              type="button"
              onClick={() => setCashCheckOpen(true)}
              className="text-sm text-brand underline"
            >
              Cash check
            </button>
          ) : undefined
        }
      />

      {(spaceError || moneyError) && <Alert>{spaceError ?? moneyError}</Alert>}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <QuickAdd />
          <ScanReceipt />
          <AccountsCard />
          <TransactionList />
        </>
      )}

      {cashCheckOpen && (
        <Modal title="Cash check" onClose={() => setCashCheckOpen(false)}>
          <CashCheck />
        </Modal>
      )}
    </div>
  )
}

export default Home
