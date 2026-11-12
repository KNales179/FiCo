import { createContext } from 'react'

export interface TourContextValue {
  /** Starts one of the guided tours (see steps.ts), on its own page. */
  startTour: (tourId: string) => void
  running: boolean
}

export const TourContext = createContext<TourContextValue | undefined>(undefined)
