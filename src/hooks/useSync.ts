import { useContext } from 'react'
import { SyncContext } from '../context/sync-context'

export const useSync = () => {
  const context = useContext(SyncContext)
  if (!context) {
    throw new Error('useSync must be used inside SyncProvider')
  }
  return context
}
