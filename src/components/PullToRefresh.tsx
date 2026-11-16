import { useCallback } from 'react'
import { useSync } from '../hooks/useSync'
import { useSpace } from '../hooks/useSpace'
import { useMoney } from '../hooks/useMoney'
import { useShopping } from '../hooks/useShopping'
import { useBills } from '../hooks/useBills'
import { PULL_THRESHOLD, usePullToRefresh } from '../hooks/usePullToRefresh'

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
  const ready = phase === 'ready' || phase === 'refreshing'
  // The ring fills as you pull; once refreshing it becomes a spinning arc.
  const RING = 2 * Math.PI * 15

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 top-0 z-30"
      style={{
        transform: `translate(-50%, ${Math.min(distance, PULL_THRESHOLD * 1.4) - 44}px) scale(${0.6 + progress * 0.4})`,
        opacity: Math.min(distance / 24, 1),
        transition: phase === 'refreshing' ? 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)' : undefined,
      }}
    >
      <span className="sr-only">{LABEL[phase === 'idle' ? 'pulling' : phase]}</span>
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-panel shadow-lg">
        <svg
          viewBox="0 0 36 36"
          width="30"
          height="30"
          aria-hidden="true"
          className={phase === 'refreshing' ? 'motion-safe:animate-spin' : undefined}
        >
          <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="3" className="text-ink" />
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            className="text-brand"
            stroke="currentColor"
            strokeDasharray={RING}
            strokeDashoffset={phase === 'refreshing' ? RING * 0.7 : RING * (1 - progress)}
            transform="rotate(-90 18 18)"
          />
          {phase !== 'refreshing' && (
            <g
              className={ready ? 'text-brand' : 'text-muted'}
              // Points down while pulling, turns to point up once letting go will refresh.
              style={{ transform: `rotate(${progress * 180}deg)`, transformOrigin: '18px 18px', transition: 'transform 120ms ease-out' }}
            >
              <path d="M18 11v12m0 0l-4.5-4.5M18 23l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          )}
        </svg>
      </div>
    </div>
  )
}

export default PullToRefresh
