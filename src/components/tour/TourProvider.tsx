import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { markTutorialSeen } from '../../features/onboarding'
import { purgeDemoData, seedDemoData } from '../../features/demo/seed'
import { isDemoMode } from '../../features/demo/demoMode'
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
  const { pathname } = useLocation()
  const navigate = useNavigate()
  // Where the tour was started — "How Fico works" gets you back there after.
  const startedFrom = useRef<string | null>(null)

  const startTour = useCallback(
    (tourId: string) => {
      const next = findTour(tourId)
      if (!next || preparing) return
      void (async () => {
        setPreparing(true)
        try {
          if (next.demo && user?.id && !isDemoMode()) {
            await seedDemoData(user.id)
            enterDemo()
          }
          startedFrom.current = pathname
          setTour(next)
        } finally {
          setPreparing(false)
        }
      })()
    },
    [enterDemo, pathname, preparing, user?.id],
  )

  const finish = useCallback(() => {
    const wasDemo = tour?.demo
    markTutorialSeen()
    setTour(null)
    if (wasDemo && !isDemoMode()) {
      exitDemo()
      void purgeDemoData()
    }
    if (startedFrom.current === '/tutorial') navigate('/tutorial')
    startedFrom.current = null
  }, [exitDemo, navigate, tour?.demo])

  const value = useMemo(() => ({ startTour, running: tour !== null }), [startTour, tour])

  return (
    <TourContext.Provider value={value}>
      {children}
      {tour && <TourOverlay key={tour.id} tour={tour} onClose={finish} />}
    </TourContext.Provider>
  )
}

export default TourProvider
