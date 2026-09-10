import { api } from '../lib/api'
import type { AnalyticsPeriod } from '../domain/analytics'
import type { Analytics } from '../features/analytics'

interface AnalyticsResponse {
  success: boolean
  analytics: Analytics
}

/**
 * Space analytics from the server — the authoritative numbers every member of a
 * shared space sees. The frontend falls back to a local computation only when
 * the server is unreachable.
 */
export const fetchAnalytics = (
  spaceId: string,
  period: AnalyticsPeriod,
  currency = 'PHP',
) =>
  api<AnalyticsResponse>(
    `/spaces/${spaceId}/analytics?period=${period}&currency=${currency}`,
  ).then((r) => r.analytics)
