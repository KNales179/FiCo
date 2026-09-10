import { transactionRepository } from '../../repositories'
import { isNetworkError } from '../../lib/api'
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
export const computeAnalytics = async (
  spaceId: string,
  period: AnalyticsPeriod,
  custom?: Partial<DateRange>,
  currency = 'PHP',
): Promise<Analytics> => {
  if (period !== 'CUSTOM') {
    try {
      const server = await fetchAnalytics(spaceId, period, currency)
      return { ...server, fromCache: false }
    } catch (err) {
      if (!isNetworkError(err)) throw err
      // offline — fall through to the local computation
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
  const inRange = all.filter(
    (t) =>
      t.occurredAt >= range.fromIso && t.occurredAt <= range.toIso,
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
