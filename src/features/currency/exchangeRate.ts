/**
 * Live currency-conversion rates, for the one case Fico is allowed to reach
 * a third-party service for: converting between two currencies on a
 * cross-currency transfer (e.g. a mother sending AED that a child receives
 * as PHP). Every other financial fact in Fico is typed in by hand — this is
 * a deliberate, narrow exception the owner approved directly, on the
 * reasoning that a rate lookup carries none of the risk of a real bank or
 * account connection.
 *
 * `open.er-api.com` needs no API key and no sign-up, so there's nothing to
 * configure and nothing secret to protect. The last rate that worked for a
 * given pair is cached in localStorage so a transfer can still go through
 * (with an honest "last known rate" label) if the lookup fails offline —
 * Fico stays local-first even for this.
 */

export interface ExchangeRateResult {
  rate: number
  fetchedAt: string
  /** True when this came from the local cache rather than a fresh lookup. */
  fromCache: boolean
}

interface CachedRate {
  rate: number
  fetchedAt: string
}

const CACHE_PREFIX = 'fico.fxRate.'
const LOOKUP_TIMEOUT_MS = 8_000

const cacheKey = (from: string, to: string) => `${CACHE_PREFIX}${from}_${to}`

const readCache = (from: string, to: string): CachedRate | null => {
  try {
    const raw = localStorage.getItem(cacheKey(from, to))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CachedRate>
    if (typeof parsed.rate !== 'number' || !Number.isFinite(parsed.rate)) {
      return null
    }
    return { rate: parsed.rate, fetchedAt: parsed.fetchedAt ?? '' }
  } catch {
    return null
  }
}

const writeCache = (from: string, to: string, rate: number, fetchedAt: string) => {
  try {
    localStorage.setItem(
      cacheKey(from, to),
      JSON.stringify({ rate, fetchedAt }),
    )
  } catch {
    // Storage full or unavailable — the lookup itself still succeeded, it
    // just won't be there as a fallback next time.
  }
}

/** The last rate Fico successfully looked up for this pair, if any — no network call. */
export const getCachedExchangeRate = (
  from: string,
  to: string,
): ExchangeRateResult | null => {
  const cached = readCache(from.toUpperCase(), to.toUpperCase())
  return cached ? { ...cached, fromCache: true } : null
}

/**
 * Looks up today's from→to rate. Falls back to the last cached rate for
 * this pair when the network call fails (offline, timeout, the service
 * being down), rather than blocking the transfer outright.
 */
export const fetchExchangeRate = async (
  from: string,
  to: string,
): Promise<ExchangeRateResult> => {
  const a = from.toUpperCase()
  const b = to.toUpperCase()
  if (a === b) {
    return { rate: 1, fetchedAt: new Date().toISOString(), fromCache: false }
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS)
    let response: Response
    try {
      response = await fetch(`https://open.er-api.com/v6/latest/${a}`, {
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }

    if (!response.ok) throw new Error('Rate lookup failed')
    const data = (await response.json()) as {
      result?: string
      rates?: Record<string, number>
    }

    const rate = data.rates?.[b]
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
      throw new Error(`No rate available for ${a} → ${b}`)
    }

    const fetchedAt = new Date().toISOString()
    writeCache(a, b, rate, fetchedAt)
    return { rate, fetchedAt, fromCache: false }
  } catch (err) {
    const cached = readCache(a, b)
    if (cached) return { ...cached, fromCache: true }
    throw err instanceof Error
      ? err
      : new Error('Could not get an exchange rate')
  }
}
