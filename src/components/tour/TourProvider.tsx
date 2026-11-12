import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { markTutorialSeen } from '../../features/onboarding'
import { purgeDemoData, seedDemoData } from '../../features/demo/seed'
import { useAuth } from '../../hooks/useAuth'
import { useSpace } from '../../hooks/useSpace'
import { TourContext } from './tour-context'
import TourOverlay from './TourOverlay'
import { findTour, type Tour } from './steps'

/**
 * Owns which tour is running. A tour marked `demo` first writes the
 * temporary Sample Finance into this device's local database and shows it
 * in place of the real Finance; ending the tour (Done, Skip, Escape)
 * switches back and wipes every sample record again.
 */
const TourProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth()
  const { enterDemo, exitDemo } = useSpace()
  const [tour, setTour] = useState<Tour | null>(null)
  const [preparing, setPreparing] = useState(false)

  const startTour = useCallback(
    (tourId: string) => {
      const next = findTour(tourId)
      if (!next || preparing) return
      void (async () => {
        setPreparing(true)
        try {
          if (next.demo && user?.id) {
            await seedDemoData(user.id)
            enterDemo()
          }
          setTour(next)
        } finally {
          setPreparing(false)
        }
      })()
    },
    [enterDemo, preparing, user?.id],
  )

  const finish = useCallback(() => {
    const wasDemo = tour?.demo
    markTutorialSeen()
    setTour(null)
    if (wasDemo) {
      exitDemo()
      void purgeDemoData()
    }
  }, [exitDemo, tour?.demo])

  const value = useMemo(() => ({ startTour, running: tour !== null }), [startTour, tour])

  return (
    <TourContext.Provider value={value}>
      {children}
      {tour && <TourOverlay key={tour.id} tour={tour} onClose={finish} />}
    </TourContext.Provider>
  )
}

export default TourProvider
