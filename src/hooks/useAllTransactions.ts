import { useEffect, useState } from 'react'
import { transactionRepository } from '../repositories'
import { onDataChanged, onMutation } from '../features/sync/events'
import type { Transaction } from '../types/models'
import { useSpace } from './useSpace'
import { useMoney } from './useMoney'

/**
 * Every transaction in the active Finance, straight from IndexedDB — for
 * charts and month totals. MoneyProvider deliberately keeps only the most
 * recent 50 for the Records list, which is far too few to total a month or
 * draw six months of history. Reloads on any local change or synced-in
 * change, and whenever MoneyProvider itself reloads.
 */
export const useAllTransactions = (): Transaction[] => {
  const { activeSpaceId } = useSpace()
  const { transactions: recent } = useMoney()
  const [all, setAll] = useState<Transaction[]>([])
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const bump = () => setTick((n) => n + 1)
    const offData = onDataChanged(bump)
    const offMutation = onMutation(bump)
    return () => {
      offData()
      offMutation()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!activeSpaceId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAll([])
      return
    }
    void transactionRepository.getAllByIndex('by-spaceId', activeSpaceId).then((rows) => {
      if (!cancelled) setAll(rows)
    })
    return () => {
      cancelled = true
    }
  }, [activeSpaceId, recent, tick])

  return all
}
