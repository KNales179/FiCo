/**
 * The server's size limits for synced records. A change that breaks one is
 * refused by the server — and would fail every single time — so anything
 * over a limit is trimmed *before* it's queued. The server is the source of
 * truth: the app downloads its limits (`refreshServerLimits`) and keeps
 * them for offline use; the values below are only the fallback until then.
 */

const CACHE_KEY = 'fico.syncLimits'

let TEXT_LIMITS: Record<string, Record<string, number>> = {
  account: { name: 60 },
  transaction: { title: 120, categoryName: 60 },
  category: { name: 40 },
  shoppingList: { title: 120 },
  shoppingItem: { name: 120 },
  itemProfile: { displayName: 120 },
  priceHistory: { name: 120, categoryName: 80 },
  bill: { name: 80 },
  reconciliation: { note: 500, resolvedNote: 500 },
}

let LIST_LIMIT = 50
let LIST_ITEM_NAME = 80

interface ServerLimits {
  text: Record<string, Record<string, number>>
  listLimit: number
  listItemName: number
}

const applyLimits = (limits: ServerLimits) => {
  if (limits?.text && typeof limits.text === 'object') TEXT_LIMITS = limits.text
  if (Number.isFinite(limits?.listLimit)) LIST_LIMIT = limits.listLimit
  if (Number.isFinite(limits?.listItemName)) LIST_ITEM_NAME = limits.listItemName
}

try {
  const cached = localStorage.getItem(CACHE_KEY)
  if (cached) applyLimits(JSON.parse(cached) as ServerLimits)
} catch {
  // Fallback values stay.
}

/** Fetch the server's current limits (once per app start is plenty). */
export const refreshServerLimits = async (
  fetchLimits: () => Promise<ServerLimits>,
): Promise<void> => {
  try {
    const limits = await fetchLimits()
    applyLimits(limits)
    localStorage.setItem(CACHE_KEY, JSON.stringify({ text: limits.text, listLimit: limits.listLimit, listItemName: limits.listItemName }))
  } catch {
    // Offline or an older server — keep what we have.
  }
}

const clip = (value: unknown, max: number) =>
  typeof value === 'string' && value.length > max ? value.slice(0, max).trimEnd() : value

/** A copy of `payload` that fits the server's limits (unchanged if it already does). */
export const fitToServerLimits = (entityType: string, payload: unknown): unknown => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload
  const record = { ...(payload as Record<string, unknown>) }

  for (const [field, max] of Object.entries(TEXT_LIMITS[entityType] ?? {})) {
    if (field in record) record[field] = clip(record[field], max)
  }

  if (entityType === 'budgetPlan') {
    for (const key of ['plannedItems', 'weeklyStaples'] as const) {
      const list = record[key]
      if (Array.isArray(list)) {
        record[key] = list.slice(0, LIST_LIMIT).map((item) =>
          item && typeof item === 'object' ? { ...item, name: clip((item as { name?: unknown }).name, LIST_ITEM_NAME) } : item,
        )
      }
    }
    if (Array.isArray(record.includedOverdueBillIds)) {
      record.includedOverdueBillIds = record.includedOverdueBillIds.slice(0, LIST_LIMIT)
    }
  }

  return record
}
