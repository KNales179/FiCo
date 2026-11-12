import { useEffect, useState, useSyncExternalStore } from 'react'
import { APPEARANCE_EVENT, loadAppearance } from '../features/theme'
import { fetchExchangeRate, getCachedExchangeRate } from '../features/currency/exchangeRate'
import { minorPerMajor } from '../domain/money'
import { useSpace } from './useSpace'

const subscribe = (onChange: () => void) => {
  window.addEventListener(APPEARANCE_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(APPEARANCE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}
const snapshot = () => loadAppearance().displayCurrency ?? ''

/** Refresh the rate at most this often; otherwise the cached one is used. */
const FRESH_MS = 12 * 60 * 60 * 1000

/**
 * The person's own "also show me in…" currency (Settings → Currency), plus
 * the rate from the active Finance's currency into it. Purely a view on
 * this device — nothing is converted or stored, and nobody else in the
 * Finance is affected. `convert` returns null whenever there's nothing to
 * show (off, same currency, a different source currency, or no rate yet).
 */
export const useDisplayCurrency = () => {
  const target = useSyncExternalStore(subscribe, snapshot, () => '')
  const { activeSpace } = useSpace()
  const base = activeSpace?.currency ?? 'PHP'
  const active = target !== '' && target !== base

  const [fetched, setFetched] = useState<{ key: string; rate: number } | null>(null)
  const key = `${base}_${target}`
  const cached = active ? getCachedExchangeRate(base, target) : null

  useEffect(() => {
    if (!active) return
    const c = getCachedExchangeRate(base, target)
    if (c && Date.now() - Date.parse(c.fetchedAt) < FRESH_MS) return
    let cancelled = false
    fetchExchangeRate(base, target)
      .then((r) => {
        if (!cancelled) setFetched({ key: `${base}_${target}`, rate: r.rate })
      })
      .catch(() => {
        // Offline and nothing cached — just don't show a converted amount.
      })
    return () => {
      cancelled = true
    }
  }, [active, base, target])

  const rate = !active ? null : fetched?.key === key ? fetched.rate : (cached?.rate ?? null)

  const convert = (minor: number, from: string): number | null => {
    if (!active || rate == null || from !== base) return null
    return Math.round((minor / minorPerMajor(from)) * rate * minorPerMajor(target))
  }

  return { target: active ? target : null, base, rate, convert }
}
