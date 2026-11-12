import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { markTutorialSeen } from '../../features/onboarding'
import { TourContext } from './tour-context'
import TourOverlay from './TourOverlay'

/** Owns whether the guided tour is running; the overlay does the rest. */
const TourProvider = ({ children }: { children: ReactNode }) => {
  const [running, setRunning] = useState(false)

  const startTour = useCallback(() => setRunning(true), [])
  const finish = useCallback(() => {
    markTutorialSeen()
    setRunning(false)
  }, [])

  const value = useMemo(() => ({ startTour, running }), [startTour, running])

  return (
    <TourContext.Provider value={value}>
      {children}
      {running && <TourOverlay onClose={finish} />}
    </TourContext.Provider>
  )
}

export default TourProvider
