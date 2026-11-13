import { useEffect, useRef, useState } from 'react'
import { formatMoney } from '../../domain/money'
import type { AccountWithBalance } from '../../features/money'
import { gsap, prefersReducedMotion } from '../../lib/motion'
import { IconCheck, IconStar, IconX } from '../icons'
import type { PinMode, PinnedChoice } from '../../features/dashboard/pinnedBalance'

/**
 * "Pin a balance" — pick an account (say, On hand) to see first, either next
 * to the Total balance or in its place.
 */
export const PinMenu = ({
  accounts,
  current,
  onChange,
}: {
  accounts: AccountWithBalance[]
  current: PinnedChoice | null
  onChange: (choice: PinnedChoice | null) => void
}) => {
  const [open, setOpen] = useState(false)
  // Floats above the page (fixed), so the card's edges can't clip it.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const toggle = () => {
    if (open) {
      setOpen(false)
      return
    }
    const r = buttonRef.current?.getBoundingClientRect()
    if (r) {
      const width = Math.min(288, window.innerWidth - 32)
      setPos({ top: r.bottom + 8, left: Math.max(16, Math.min(r.left, window.innerWidth - width - 16)) })
    }
    setOpen(true)
  }
  const [mode, setMode] = useState<PinMode>(current?.mode ?? 'beside')
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    // It floats in place, so scrolling the page closes it.
    const onScroll = () => setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll)
    }
  }, [open])

  useEffect(() => {
    const el = panelRef.current
    if (!open || !el || prefersReducedMotion()) return
    const t = gsap.fromTo(el, { autoAlpha: 0, y: -6 }, { autoAlpha: 1, y: 0, duration: 0.18, clearProps: 'transform,opacity,visibility' })
    return () => {
      t.kill()
    }
  }, [open])

  const active = accounts.filter((a) => a.status === 'ACTIVE')

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={current ? 'Change pinned balance' : 'Pin a balance'}
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium normal-case tracking-normal transition-colors ${
          current ? 'border-brand/40 bg-brand/10 text-brand' : 'border-line text-muted hover:border-brand/40 hover:text-brand'
        }`}
      >
        <IconStar size={12} />
        {current ? 'Pinned' : 'Pin a balance'}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Pin a balance"
          style={pos ? { top: pos.top, left: pos.left } : undefined}
          className="fixed z-40 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-line bg-panel p-3 text-left normal-case tracking-normal shadow-xl"
        >
          <p className="text-sm font-semibold text-ink">Pin a balance</p>
          <p className="mt-0.5 text-xs text-muted">See the account you check most, right at the top.</p>

          <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-panel-2 p-1 text-xs" role="radiogroup" aria-label="Where to show it">
            {(
              [
                ['beside', 'Next to Total'],
                ['instead', 'Instead of Total'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={mode === value}
                onClick={() => {
                  setMode(value)
                  if (current) onChange({ ...current, mode: value })
                }}
                className={`rounded-lg px-2 py-1.5 font-medium transition-colors ${mode === value ? 'bg-brand text-brand-ink' : 'text-muted hover:text-ink'}`}
              >
                {label}
              </button>
            ))}
          </div>

          <ul className="mt-2 max-h-56 overflow-y-auto">
            {active.map((a) => {
              const selected = current?.accountId === a.id
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange({ accountId: a.id, mode })
                      setOpen(false)
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                      selected ? 'bg-brand/10' : 'hover:bg-panel-2'
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate text-ink">{a.name}</span>
                    <span className="tabular-nums text-xs text-muted">{formatMoney(a.balanceMinor, a.currency)}</span>
                    {selected && <IconCheck size={14} className="text-brand" />}
                  </button>
                </li>
              )
            })}
            {active.length === 0 && <li className="px-2 py-2 text-xs text-muted">Add an account first.</li>}
          </ul>

          {current && (
            <button
              type="button"
              onClick={() => {
                onChange(null)
                setOpen(false)
              }}
              className="mt-2 inline-flex items-center gap-1 text-xs text-muted hover:text-danger"
            >
              <IconX size={12} /> Unpin — show just the Total
            </button>
          )}
        </div>
      )}
    </div>
  )
}
