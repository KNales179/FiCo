import type { ReactNode } from 'react'
import { IconCheck, IconCompass, IconLock, IconReceipt, IconUsers } from '../icons'

/**
 * Purpose, mission and vision: each its own section, with an illustration
 * made of the same cards and chips the app itself uses, so the picture is
 * the product, not stock art.
 */

const Bubble = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`max-w-[16rem] rounded-2xl border border-line bg-panel px-4 py-2.5 text-sm text-ink shadow-sm ${className}`}>
    {children}
  </div>
)

/** Purpose: scattered money questions, answered by one Fico card. */
export const PurposeArt = () => (
  <div className="relative mx-auto flex w-full max-w-md flex-col gap-3 py-4">
    <Bubble className="-rotate-2 self-start">Who paid the electric bill?</Bubble>
    <Bubble className="rotate-1 self-end">Do we still have money for groceries?</Bubble>
    <Bubble className="-rotate-1 ml-6 self-start">Wait… did we pay the water already??</Bubble>
    <div className="card mt-2 space-y-3 p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
        <IconReceipt size={14} /> One honest place
      </p>
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink">Electric bill</span>
        <span className="inline-flex items-center gap-1 font-semibold text-success">
          <IconCheck size={14} /> Paid by Ana
        </span>
      </div>
      <div className="text-sm">
        <div className="flex items-center justify-between">
          <span className="text-ink">Groceries budget</span>
          <span className="font-semibold tabular-nums text-ink">₱1,240 left</span>
        </div>
        <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-panel-2">
          <span className="block h-full w-[62%] rounded-full bg-brand" />
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink">Water</span>
        <span className="font-medium text-warning">Due in 3 days</span>
      </div>
    </div>
  </div>
)

/** Mission: the three promises, as three small cards. */
export const MissionArt = () => (
  <div className="mx-auto grid w-full max-w-md gap-3">
    <div className="card flex items-center gap-4 p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
        <IconCompass size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-ink">Simple</p>
        <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-xs text-muted">
          <span className="font-semibold tabular-nums text-ink">₱150</span>
          <span className="truncate">Lunch</span>
          <span className="ml-auto rounded-md bg-brand px-2 py-0.5 font-semibold text-brand-ink">Add</span>
        </div>
      </div>
    </div>
    <div className="card flex items-center gap-4 p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
        <IconLock size={22} />
      </span>
      <div className="min-w-0">
        <p className="font-bold text-ink">Private</p>
        <p className="mt-0.5 text-xs text-muted">No bank logins to hand over · No ads · No tracking</p>
      </div>
    </div>
    <div className="card flex items-center gap-4 p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
        <IconUsers size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-ink">Together</p>
        <div className="mt-1.5 flex items-center">
          {['A', 'B', 'L', 'M'].map((initial, i) => (
            <span
              key={initial}
              className="-ml-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-panel bg-brand text-xs font-bold text-brand-ink first:ml-0"
              style={{ opacity: 1 - i * 0.15 }}
            >
              {initial}
            </span>
          ))}
          <span className="ml-2 text-xs text-muted">4 people, one Finance</span>
        </div>
      </div>
    </div>
  </div>
)

/** Vision: a calm month: payday, bills paid, and money left at the end. */
export const VisionArt = () => {
  const paid = new Set([3, 8, 16])
  const payday = new Set([15, 30])
  return (
    <div className="card mx-auto w-full max-w-md p-5">
      <div className="flex items-center justify-between">
        <p className="font-bold text-ink">November</p>
        <p className="text-xs text-muted">No surprises this month</p>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-xs">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={i} className="pb-1 font-semibold text-muted">
            {d}
          </span>
        ))}
        {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => (
          <span
            key={day}
            className={[
              'flex aspect-square items-center justify-center rounded-lg tabular-nums',
              payday.has(day)
                ? 'bg-success/15 font-bold text-success'
                : paid.has(day)
                  ? 'bg-brand/15 font-semibold text-brand'
                  : 'text-muted',
            ].join(' ')}
          >
            {day}
          </span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-success/40" /> Payday
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-brand/40" /> Bill paid
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between rounded-xl border border-line bg-panel-2 px-4 py-3">
        <span className="text-sm text-muted">Left at month’s end</span>
        <span className="inline-flex items-center gap-1.5 font-bold tabular-nums text-success">
          <IconCheck size={15} /> ₱4,200
        </span>
      </div>
    </div>
  )
}
