import { transactionRepository } from '../../repositories'
import { ApiError, isNetworkError } from '../../lib/api'
import { isDemoSpace } from '../demo/space'
import { fetchAnalytics } from '../../services/analyticsService'
import { listShoppingLists, computeListTotals } from '../shopping'
import { listItems } from '../shopping/items'
import {
  resolveRange,
  summarize,
  type AnalyticsPeriod,
  type AnalyticsSummary,
  type DateRange,
} from '../../domain/analytics'

export interface ShoppingPlannedVsActual {
  plannedMinor: number
  actualMinor: number
  listCount: number
}

export interface Analytics extends AnalyticsSummary {
  range: DateRange
  shopping: ShoppingPlannedVsActual
  /** True when the numbers came from the local cache (server unreachable). */
  fromCache?: boolean
}

/**
 * Space analytics. Prefers the server so every member of a shared space sees
 * the same numbers (Roadmap Phase 15); falls back to a local computation over
 * IndexedDB when offline.
 */
/**
 * The server couldn't give an answer, so local numbers are the best we have:
 * no connection, our own timeout, the host waking up (api() reports those
 * error pages as a NetworkError), or the server itself failing (5xx).
 * A 4xx is a real answer ("not a member", "signed out") and still throws.
 */
const serverUnavailable = (err: unknown) =>
  isNetworkError(err) || (err instanceof ApiError && err.status >= 500)

export const computeAnalytics = async (
  spaceId: string,
  period: AnalyticsPeriod,
  custom?: Partial<DateRange>,
  currency = 'PHP',
): Promise<Analytics> => {
  // The tour's sample Finance only exists on this device.
  // When the device already knows it's offline, don't wait on a request
  // that can only time out.
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  if (period !== 'CUSTOM' && !isDemoSpace(spaceId) && !offline) {
    try {
      const server = await fetchAnalytics(spaceId, period, currency)
      return { ...server, fromCache: false }
    } catch (err) {
      if (!serverUnavailable(err)) throw err
      // unreachable — fall through to the local computation
    }
  }

  return computeAnalyticsLocally(spaceId, period, custom, currency)
}

const computeAnalyticsLocally = async (
  spaceId: string,
  period: AnalyticsPeriod,
  custom?: Partial<DateRange>,
  currency = 'PHP',
): Promise<Analytics> => {
  const range = resolveRange(period, custom)

  const all = await transactionRepository.getAllByIndex(
    'by-spaceId',
    spaceId,
  )
  // Private records stay out of shared analytics, same as on the server.
  const inRange = all.filter(
    (t) =>
      t.visibility !== 'PRIVATE' &&
      t.occurredAt >= range.fromIso &&
      t.occurredAt <= range.toIso,
  )

  const summary = summarize(inRange, currency)

  // Shopping planned vs actual, for lists completed within the range.
  const lists = await listShoppingLists(spaceId)
  let plannedMinor = 0
  let actualMinor = 0
  let listCount = 0
  for (const list of lists) {
    if (list.status !== 'COMPLETED') continue
    const completedAt = list.completedAt ?? list.updatedAt
    if (completedAt < range.fromIso || completedAt > range.toIso) continue
    const items = await listItems(list.id)
    const totals = computeListTotals(list, items)
    for (const item of items) {
      plannedMinor += item.plannedPriceMinor ?? 0
    }
    actualMinor += totals.spentMinor
    listCount += 1
  }

  return {
    ...summary,
    range,
    shopping: { plannedMinor, actualMinor, listCount },
    fromCache: true,
  }
}
