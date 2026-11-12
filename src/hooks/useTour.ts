import { useContext } from 'react'
import { TourContext } from '../components/tour/tour-context'

export const useTour = () => {
  const context = useContext(TourContext)

  if (!context) {
    throw new Error('useTour must be used inside TourProvider')
  }

  return context
}
