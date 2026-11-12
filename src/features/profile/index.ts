import type { Birthday } from '../../types/auth'

/**
 * Birthday & payday helpers — pure, local-date based (a birthday is a
 * calendar day where the person lives, not a UTC instant).
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const monthName = (month: number) => MONTHS[month - 1] ?? ''

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

export const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate()

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/** The birthday as it falls in `year` — Feb 29 is celebrated on Feb 28 in a non-leap year. */
export const birthdayInYear = (b: Birthday, year: number): Date => {
  const day = b.month === 2 && b.day === 29 && !isLeap(year) ? 28 : b.day
  return new Date(year, b.month - 1, day)
}

/** The next time the birthday comes round, today included. */
export const nextBirthday = (b: Birthday, today = new Date()): Date => {
  const t = startOfDay(today)
  const thisYear = birthdayInYear(b, t.getFullYear())
  return thisYear >= t ? thisYear : birthdayInYear(b, t.getFullYear() + 1)
}

export const daysUntil = (date: Date, today = new Date()): number =>
  Math.round((startOfDay(date).getTime() - startOfDay(today).getTime()) / 86_400_000)

export const isBirthdayToday = (b: Birthday, today = new Date()): boolean =>
  daysUntil(nextBirthday(b, today), today) === 0

/** How old they turn on `on` — null when they'd rather not give a year. */
export const turningAge = (b: Birthday, on: Date): number | null =>
  b.year ? on.getFullYear() - b.year : null

export const ordinal = (n: number): string => {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`
}

/** "March 14" (and the weekday when it helps: "Saturday, March 14"). */
export const formatBirthday = (b: Pick<Birthday, 'month' | 'day'>, withYear?: number | null): string =>
  `${monthName(b.month)} ${b.day}${withYear ? `, ${withYear}` : ''}`

export const formatDay = (d: Date): string =>
  d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

/** The birthday's date inside a "YYYY-MM" budget period, or null if it's another month. */
export const birthdayInPeriod = (b: Birthday, period: string): Date | null => {
  const [y, m] = period.split('-').map(Number)
  if (!y || m !== b.month) return null
  return birthdayInYear(b, y)
}

/** A payday's actual date in a month — 31 (or any day past the end) means the last day. */
export const paydayInMonth = (payday: number, year: number, month: number): Date =>
  new Date(year, month - 1, Math.min(payday, daysInMonth(year, month)))

export const paydayLabel = (payday: number): string => (payday >= 31 ? 'last day of the month' : ordinal(payday))

/** The latest payday on or before `date`, looking back up to `withinDays` — "you get paid right before it". */
export const paydayRightBefore = (paydays: number[], date: Date, withinDays = 10): Date | null => {
  let best: Date | null = null
  for (const back of [0, 1]) {
    const ref = new Date(date.getFullYear(), date.getMonth() - back, 1)
    for (const p of paydays) {
      const d = paydayInMonth(p, ref.getFullYear(), ref.getMonth() + 1)
      const gap = daysUntil(date, d)
      if (gap >= 0 && gap <= withinDays && (!best || d > best)) best = d
    }
  }
  return best
}

/** A modest treat: about 5% of the month's income, rounded to a friendly figure. */
export const suggestTreatMinor = (incomeMinor: number): number => {
  if (!incomeMinor || incomeMinor <= 0) return 100_000 // 1,000.00
  const raw = incomeMinor * 0.05
  const step = raw >= 200_000 ? 50_000 : 10_000 // round to 500s above 2,000, else 100s
  return Math.min(1_000_000, Math.max(50_000, Math.round(raw / step) * step))
}

const pick = <T,>(list: T[], seed: number): T => list[Math.abs(seed) % list.length]

export interface BirthdayNudge {
  title: string
  body: string
  paydayNote: string | null
}

/**
 * The Budget page's "it's your birthday that month" note. Worded from what
 * Fico knows: when it is relative to today, how old they turn (if a year is
 * on file), and whether a payday lands just before it.
 */
export const birthdayBudgetNudge = (opts: {
  birthday: Birthday
  period: string
  name: string
  paydays: number[]
  today?: Date
}): BirthdayNudge | null => {
  const today = opts.today ?? new Date()
  const date = birthdayInPeriod(opts.birthday, opts.period)
  if (!date || daysUntil(date, today) < 0) return null

  const monthsAhead =
    (date.getFullYear() - today.getFullYear()) * 12 + (date.getMonth() - today.getMonth())
  const when = monthsAhead === 0 ? 'this month' : monthsAhead === 1 ? 'next month' : `in ${monthName(date.getMonth() + 1)}`
  const age = turningAge(opts.birthday, date)
  const dayText = formatDay(date)
  const name = opts.name
  const seed = date.getFullYear() + opts.birthday.month * 31 + opts.birthday.day

  const title = age
    ? `${name}, you turn ${age} ${when}!`
    : `It's your birthday ${when}, ${name}!`

  const body = pick(
    [
      `Your day is ${dayText}. How about setting aside a little to treat yourself? Here in Fico, we know how much you deserve a treat once in a while.`,
      `${dayText} is all about you. Put a small treat in the plan now, so you can enjoy it on the day without a single pang of guilt.`,
      `Mark it: ${dayText}. A little birthday money in the budget means a cake, a nice dinner, or that thing you've been eyeing — planned, not impulsive.`,
    ],
    seed,
  )

  const payday = paydayRightBefore(opts.paydays, date)
  const paydayNote = payday
    ? daysUntil(date, payday) === 0
      ? 'And you get paid that very day — happy birthday indeed.'
      : `Good timing, too: your payday on the ${ordinal(payday.getDate())} lands right before it.`
    : null

  return { title, body, paydayNote }
}

/** The greeting shown when Fico is opened on their birthday. */
export const birthdayGreeting = (opts: { birthday: Birthday; name: string; today?: Date }) => {
  const today = opts.today ?? new Date()
  const age = turningAge(opts.birthday, today)
  const title = age ? `Happy ${ordinal(age)} birthday, ${opts.name}!` : `Happy birthday, ${opts.name}!`
  const body = pick(
    [
      "From all of us at Fico: today's about you, not your budget. Go enjoy it — you've more than earned it.",
      'Another year of showing up for your money and the people you share it with. We’re proud of you. Now go treat yourself!',
      'Today the only number that matters is the candles on your cake. Fico will still be here tomorrow to log the damage.',
    ],
    today.getFullYear() + (age ?? 0),
  )
  return { title, body }
}

/** The Account page's optional "About you" card (a CollapsibleCard id, and its anchor). */
export const ABOUT_SECTION_ID = 'account.about'
