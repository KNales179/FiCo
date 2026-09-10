import { useContext } from 'react'
import { ShoppingContext } from '../context/shopping-context'

export const useShopping = () => {
  const context = useContext(ShoppingContext)
  if (!context) {
    throw new Error('useShopping must be used inside ShoppingProvider')
  }
  return context
}
