import { useContext } from 'react'
import { BillsContext } from '../context/bills-context'

export const useBills = () => {
  const context = useContext(BillsContext)
  if (!context) {
    throw new Error('useBills must be used inside BillsProvider')
  }
  return context
}
