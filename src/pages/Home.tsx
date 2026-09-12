import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useSpace } from '../hooks/useSpace'
import { useMoney } from '../hooks/useMoney'
import { PageHeader, Alert, Modal, Button, SkeletonCard } from '../components/ui'
import { IconClipboardCheck } from '../components/icons'
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
            <Button onClick={() => setCashCheckOpen(true)}>
              <IconClipboardCheck size={16} />
              Cash check
            </Button>
          ) : undefined
        }
      />

      {(spaceError || moneyError) && <Alert>{spaceError ?? moneyError}</Alert>}

      {loading ? (
        <div className="space-y-4">
          <SkeletonCard lines={1} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={4} />
        </div>
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
