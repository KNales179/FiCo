import { createContext } from 'react'
import type { SpaceSummary } from '../types/space'

export interface SpaceContextValue {
  spaces: SpaceSummary[]
  activeSpace: SpaceSummary | null
  activeSpaceId: string | null
  loading: boolean
  /** True when the list came from the local cache because the server was unreachable. */
  fromCache: boolean
  error: string | null
  switchSpace: (spaceId: string) => Promise<void>
  refresh: () => Promise<void>
  createSpace: (name: string) => Promise<SpaceSummary>
  /** True while a guided tour is showing the temporary sample Finance. */
  demo: boolean
  /** Shows the sample Finance in place of the real one (not saved, not synced). */
  enterDemo: () => void
  /** Back to the real active Finance. */
  exitDemo: () => void
}

export const SpaceContext = createContext<SpaceContextValue | undefined>(
  undefined,
)
