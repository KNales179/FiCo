import { useCallback } from 'react'
import { useSync } from '../hooks/useSync'
import { useSpace } from '../hooks/useSpace'
import { useMoney } from '../hooks/useMoney'
import { useShopping } from '../hooks/useShopping'
import { useBills } from '../hooks/useBills'
import { PULL_THRESHOLD, usePullToRefresh } from '../hooks/usePullToRefresh'
import { IconRotateCcw } from './icons'

/** How long the gesture waits on the server before letting go of it. */
const SYNC_WAIT_MS = 8_000

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const LABEL = {
  pulling: 'Pull to refresh',
  ready: 'Release to refresh',
  refreshing: 'Refreshing…',
} as const

/**
 * Pull down from the top of any page to refresh. In a local-first app,
 * "refresh" means re-reading what's on the device and running a sync — not
 * a page reload — so it's instant offline and never blanks the screen. The
 * gesture stops waiting on the server after a few seconds (a sleeping
 * free-tier backend can take far longer), while the sync itself carries on
 * in the background and updates the page whenever it finishes.
 */
const PullToRefresh = () => {
  const { syncNow } = useSync()
  const { refresh: refreshSpaces } = useSpace()
  const { refresh: refreshMoney } = useMoney()
  const { refresh: refreshShopping } = useShopping()
  const { refresh: refreshBills } = useBills()

  const onRefresh = useCallback(async () => {
    const reloadLocal = Promise.allSettled([
      refreshSpaces(),
      refreshMoney(),
      refreshShopping(),
      refreshBills(),
    ])
    await Promise.race([syncNow(), wait(SYNC_WAIT_MS)])
    await reloadLocal
  }, [syncNow, refreshSpaces, refreshMoney, refreshShopping, refreshBills])

  const { distance, phase } = usePullToRefresh(onRefresh)

  if (phase === 'idle' && distance === 0) return null

  const progress = Math.min(distance / PULL_THRESHOLD, 1)

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 top-0 z-30"
      style={{
        transform: `translate(-50%, ${distance - 36}px)`,
        opacity: Math.min(distance / 30, 1),
      }}
    >
      <div
        className={`flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink shadow-md ${
          phase === 'refreshing' ? 'motion-safe:animate-pulse' : ''
        }`}
      >
        <IconRotateCcw
          size={14}
          style={{ transform: `rotate(${progress * 180}deg)` }}
        />
        {LABEL[phase === 'idle' ? 'pulling' : phase]}
      </div>
    </div>
  )
}

export default PullToRefresh
