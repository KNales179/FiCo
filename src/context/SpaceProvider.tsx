import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { isNetworkError } from '../lib/api'
import {
  MetadataKeys,
  metadataRepository,
} from '../repositories'
import {
  createSpace as createSpaceRequest,
  listSpaces,
} from '../services/spaceService'
import {
  cacheSpaces,
  loadCachedSpaces,
} from '../features/spaces/spaceCache'
import type { SpaceSummary } from '../types/space'
import { useAuth } from '../hooks/useAuth'
import { SpaceContext } from './space-context'
import { DEMO_SPACE_ID, demoSpaceSummary } from '../features/demo/space'
import { isDemoMode } from '../features/demo/demoMode'

const pickDefaultSpaceId = (spaces: SpaceSummary[]): string | null => {
  if (spaces.length === 0) return null
  const personal = spaces.find((space) => space.type === 'PERSONAL')
  return (personal ?? spaces[0]).id
}

export const SpaceProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAuthenticated } = useAuth()
  const userId = user?.id ?? null

  const [spaces, setSpaces] = useState<SpaceSummary[]>([])
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [fromCache, setFromCache] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The tour's sample Finance overrides the active one only in memory — the
  // stored active-space choice is never touched, so exiting (or a reload)
  // lands right back where the person was.
  const [demo, setDemo] = useState(false)
  const enterDemo = useCallback(() => setDemo(true), [])
  const exitDemo = useCallback(() => setDemo(false), [])

  const applySpaces = useCallback(
    async (next: SpaceSummary[]) => {
      setSpaces(next)

      const stored = await metadataRepository.get<string>(
        MetadataKeys.activeSpaceId,
      )
      const valid = next.some((space) => space.id === stored)
      const resolved = valid ? stored! : pickDefaultSpaceId(next)

      setActiveSpaceId(resolved)
      if (resolved && resolved !== stored) {
        await metadataRepository.set(MetadataKeys.activeSpaceId, resolved)
      }
    },
    [],
  )

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)

    if (isDemoMode()) {
      await applySpaces([{ ...demoSpaceSummary(userId), name: 'Dela Cruz Family (demo)' }])
      setFromCache(false)
      setLoading(false)
      return
    }

    try {
      const response = await listSpaces()
      await cacheSpaces(response.spaces, userId)
      await applySpaces(response.spaces)
      setFromCache(false)
    } catch (err) {
      if (isNetworkError(err)) {
        const cached = await loadCachedSpaces(userId)
        await applySpaces(cached)
        setFromCache(true)
      } else {
        setError(
          err instanceof Error ? err.message : 'Could not load spaces',
        )
      }
    } finally {
      setLoading(false)
    }
  }, [userId, applySpaces])

  useEffect(() => {
    if (isAuthenticated && userId) {
      // Fetch-on-auth-change: load() flips `loading` before its first await.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void load()
    }
  }, [isAuthenticated, userId, load])

  const signedIn = isAuthenticated && !!userId

  const switchSpace = useCallback(
    async (spaceId: string) => {
      setActiveSpaceId((current) => {
        const exists = spaces.some((space) => space.id === spaceId)
        return exists ? spaceId : current
      })
      if (spaces.some((space) => space.id === spaceId)) {
        await metadataRepository.set(MetadataKeys.activeSpaceId, spaceId)
      }
    },
    [spaces],
  )

  const createSpace = useCallback(
    async (name: string): Promise<SpaceSummary> => {
      if (isDemoMode()) {
        throw new Error('The demo has one sample Finance — create a free account to make your own.')
      }
      const response = await createSpaceRequest(name)
      await load()
      await switchSpace(response.space.id)
      return response.space
    },
    [load, switchSpace],
  )

  const realActiveSpace = useMemo(
    () => spaces.find((space) => space.id === activeSpaceId) ?? null,
    [spaces, activeSpaceId],
  )
  const demoSpace = useMemo(
    () => (demo && userId ? demoSpaceSummary(userId, realActiveSpace?.currency ?? 'PHP') : null),
    [demo, userId, realActiveSpace?.currency],
  )
  const activeSpace = demoSpace ?? realActiveSpace
  const shownSpaces = useMemo(
    () => (demoSpace ? [...spaces, demoSpace] : spaces),
    [spaces, demoSpace],
  )

  // When signed out, present an empty state without mutating stored state;
  // the next sign-in repopulates it via `load()`.
  const value = signedIn
    ? {
        spaces: shownSpaces,
        activeSpace,
        activeSpaceId: demoSpace ? DEMO_SPACE_ID : activeSpaceId,
        loading,
        fromCache,
        error,
        switchSpace,
        refresh: load,
        createSpace,
        demo: Boolean(demoSpace),
        enterDemo,
        exitDemo,
      }
    : {
        spaces: [],
        activeSpace: null,
        activeSpaceId: null,
        loading: false,
        fromCache: false,
        error: null,
        switchSpace,
        refresh: load,
        createSpace,
        demo: false,
        enterDemo,
        exitDemo,
      }

  return (
    <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>
  )
}
