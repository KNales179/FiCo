import { createContext } from 'react'

export interface TourContextValue {
  /** Starts the guided tour from the first step (moving to the dashboard first). */
  startTour: () => void
  running: boolean
}

export const TourContext = createContext<TourContextValue | undefined>(undefined)
