import { useEffect, useRef, useState, type ReactNode } from 'react'
import RollingNumber from '../RollingNumber'
import { IconCheck, IconCompass, IconLock, IconReceipt, IconUsers } from '../icons'

/**
 * Purpose, mission and vision: each its own section, with an illustration
 * made of the same cards and chips the app itself uses, so the picture is
 * the product, not stock art.
 */

const Bubble = ({ children, className = '', onMouseEnter }: { children: ReactNode; className?: string; onMouseEnter?: () => void }) => (
  <div onMouseEnter={onMouseEnter} className={`max-w-[16rem] rounded-2xl border border-line bg-panel px-4 py-2.5 text-sm text-ink shadow-sm ${className}`}>
    {children}
  </div>
)

/**
 * A chat bubble that, on hover, looks like someone typing it: the "…"
 * typing dots first, then the message letter by letter. The full text
 * stays underneath (invisible), so the bubble never changes size.
 */
const TypingBubble = ({ text, className = '' }: { text: string; className?: string }) => {
  const [shown, setShown] = useState<number | null>(null) // null = resting, full text
  const [dots, setDots] = useState(false)
  const timers = useRef<number[]>([])
  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }
  useEffect(() => clear, [])

  const type = () => {
    if (timers.current.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setDots(true)
    setShown(0)
    timers.current.push(
      window.setTimeout(() => {
        setDots(false)
        for (let i = 1; i <= text.length; i++) {
          timers.current.push(
            window.setTimeout(() => {
              setShown(i)
              if (i === text.length) {
                timers.current.push(
                  window.setTimeout(() => {
                    setShown(null)
                    timers.current = []
                  }, 600),
                )
              }
            }, i * 38),
          )
        }
      }, 650),
    )
  }

  const typing = shown !== null
  return (
    <Bubble className={`relative cursor-default ${className}`} onMouseEnter={type}>
      <span className="block">
        {/* Holds the bubble's size; the typed text sits on top of it. */}
        <span className={typing ? 'invisible' : undefined}>{text}</span>
        {typing && (
          <span className="absolute inset-0 px-4 py-2.5" aria-hidden="true">
            {dots ? (
              <span className="typing-dots inline-flex h-full items-center gap-1">
                <span />
                <span />
                <span />
              </span>
            ) : (
              <>
                {text.slice(0, shown ?? 0)}
                <span className="typing-caret" />
              </>
            )}
          </span>
        )}
      </span>
    </Bubble>
  )
}

/** Purpose: scattered money questions, answered by one Fico card. */
export const PurposeArt = () => (
  <div className="relative mx-auto flex w-full max-w-md flex-col gap-3 py-4">
    <TypingBubble className="-rotate-2 self-start" text="Who paid the electric bill?" />
    <TypingBubble className="rotate-1 self-end" text="Do we still have money for groceries?" />
    <TypingBubble className="-rotate-1 ml-6 self-start" text="Wait… did we pay the water already??" />
    <div className="card hover-card mt-2 space-y-3 p-4">
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
          <span className="font-semibold tabular-nums text-ink"><RollingNumber spinOnHover value="₱1,240" /> left</span>
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
    <div className="card hover-card flex items-center gap-4 p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
        <IconCompass size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-ink">Simple</p>
        <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-xs text-muted">
          <span className="font-semibold tabular-nums text-ink"><RollingNumber spinOnHover value="₱150" /></span>
          <span className="truncate">Lunch</span>
          <span className="ml-auto rounded-md bg-brand px-2 py-0.5 font-semibold text-brand-ink">Add</span>
        </div>
      </div>
    </div>
    <div className="card hover-card flex items-center gap-4 p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
        <IconLock size={22} />
      </span>
      <div className="min-w-0">
        <p className="font-bold text-ink">Private</p>
        <p className="mt-0.5 text-xs text-muted">No bank logins to hand over · No ads · No tracking</p>
      </div>
    </div>
    <div className="card hover-card flex items-center gap-4 p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
        <IconUsers size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-ink">Together</p>
        <div className="mt-1.5 flex items-center">
          {[
            ['A', 'cool-cat'],
            ['B', 'cap-puppy'],
            ['L', 'glasses-doll'],
            ['M', 'gamer-cat'],
          ].map(([initial, photo]) => (
            <img
              key={initial}
              src={`/avatars/${photo}.webp`}
              alt={initial}
              title={initial}
              loading="lazy"
              className="-ml-2 h-8 w-8 rounded-full border-2 border-panel object-cover first:ml-0"
            />
          ))}
          <span className="ml-2 text-xs text-muted">4 people, one Finance</span>
        </div>
      </div>
    </div>
  </div>
)

/** Vision: a calm month: payday, bills paid, and money left at the end. */
/** The same bills fall on these dates every month (sample data). */
const BILL_DAYS = [1, 3, 8, 16, 20, 27]
const PAYDAYS = [15, 31] // 31 = the month's last day, as in the app

/**
 * Vision: the app's money calendar with sample data, on the real current
 * month — today marked, bills before today paid, bills from today on due,
 * paydays on the 15th and the last day.
 */
export const VisionArt = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const today = now.getDate()
  const days = new Date(year, month + 1, 0).getDate()
  const leading = new Date(year, month, 1).getDay()
  const payday = new Set(PAYDAYS.map((p) => Math.min(p, days)))
  const monthName = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const dueLeft = BILL_DAYS.filter((d) => d >= today && d <= days).length

  return (
    <div className="card hover-card mx-auto w-full max-w-md p-5">
      <div className="flex items-center justify-between">
        <p className="font-bold text-ink">{monthName}</p>
        <p className="text-xs text-muted">{dueLeft ? `${dueLeft} bill${dueLeft === 1 ? '' : 's'} still due` : 'All bills paid'}</p>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-xs">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={i} className="pb-1 font-semibold text-muted">
            {d}
          </span>
        ))}
        {Array.from({ length: leading }, (_, i) => (
          <span key={`blank-${i}`} aria-hidden="true" />
        ))}
        {Array.from({ length: days }, (_, i) => i + 1).map((day) => {
          const bill = BILL_DAYS.includes(day)
          const paid = bill && day < today
          const due = bill && day >= today
          return (
            <span
              key={day}
              className={[
                // Like the app's calendar; a soft highlight fades in and out on hover.
                'flex aspect-square cursor-default items-center justify-center rounded-lg tabular-nums transition-[background-color,color,scale] duration-300 ease-out hover:scale-110',
                payday.has(day)
                  ? 'bg-success/15 font-bold text-success hover:bg-success/30'
                  : paid
                    ? 'bg-brand/15 font-semibold text-brand hover:bg-brand/30'
                    : 'text-muted hover:bg-brand/15 hover:text-ink',
                due ? 'ring-1 ring-inset ring-warning' : '',
              ].join(' ')}
            >
              <span
                className={
                  day === today
                    ? 'flex h-6 w-6 items-center justify-center rounded-full bg-brand font-bold text-brand-ink'
                    : undefined
                }
              >
                {day}
              </span>
            </span>
          )
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-success/40" /> Payday
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-brand/40" /> Bill paid
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded border border-warning" /> Bill due
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-brand" /> Today
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between rounded-xl border border-line bg-panel-2 px-4 py-3">
        <span className="text-sm text-muted">Left at month’s end</span>
        <span className="inline-flex items-center gap-1.5 font-bold tabular-nums text-success">
          <IconCheck size={15} /> <RollingNumber spinOnHover value="₱4,200" />
        </span>
      </div>
    </div>
  )
}
