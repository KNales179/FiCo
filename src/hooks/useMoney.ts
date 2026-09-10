import { useContext } from 'react'
import { MoneyContext } from '../context/money-context'

export const useMoney = () => {
  const context = useContext(MoneyContext)

  if (!context) {
    throw new Error('useMoney must be used inside MoneyProvider')
  }

  return context
}
