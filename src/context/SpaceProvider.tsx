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
      const response = await createSpaceRequest(name)
      await load()
      await switchSpace(response.space.id)
      return response.space
    },
    [load, switchSpace],
  )

  const activeSpace = useMemo(
    () => spaces.find((space) => space.id === activeSpaceId) ?? null,
    [spaces, activeSpaceId],
  )

  // When signed out, present an empty state without mutating stored state;
  // the next sign-in repopulates it via `load()`.
  const value = signedIn
    ? {
        spaces,
        activeSpace,
        activeSpaceId,
        loading,
        fromCache,
        error,
        switchSpace,
        refresh: load,
        createSpace,
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
      }

  return (
    <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>
  )
}
