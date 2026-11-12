import { useEffect } from 'react'
import { useTour } from '../hooks/useTour'
import { PageSkeleton } from '../components/ui'

/**
 * "How Fico works" from the menu. Used to be a page of text; now it just
 * starts the guided tour, which takes you back to the dashboard and walks
 * through it part by part.
 */
const Tutorial = () => {
  const { startTour } = useTour()

  useEffect(() => {
    startTour()
  }, [startTour])

  return <PageSkeleton />
}

export default Tutorial
