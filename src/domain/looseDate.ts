/**
 * Postel's law for dates: accept however people type a date — "today",
 * "yesterday", "Nov 16", "16 November", "16/11", "2026-11-16", "the 3rd",
 * "3 days ago", "last friday" — and turn it into "YYYY-MM-DD". Returns null
 * only when it truly can't tell.
 *
 * `prefer` breaks ties when no year (or week) is given: a record that
 * already happened prefers the past ("Nov 30" in November 15 means last
 * year? no — the nearest one before or on today), a bill prefers the future.
 */

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

const pad = (n: number) => String(n).padStart(2, '0')
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const valid = (y: number, m: number, d: number): Date | null => {
  const date = new Date(y, m, d)
  return date.getFullYear() === y && date.getMonth() === m && date.getDate() === d ? date : null
}

const monthIndex = (word: string): number => {
  const w = word.toLowerCase().replace(/\.$/, '')
  if (w.length < 3) return -1
  return MONTHS.findIndex((m) => w.startsWith(m) && m.startsWith(w.slice(0, 3)))
}

/** Day-first ("16/11") or month-first ("11/16")? From the person's locale; the Philippines and US write month first. */
const monthFirst = (): boolean => {
  const lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US'
  return /^en-(US|PH)$/i.test(lang) || lang === 'en'
}

const fullYear = (y: number) => (y < 100 ? 2000 + y : y)

export const parseLooseDate = (
  input: string,
  options: { prefer?: 'past' | 'future'; today?: Date } = {},
): string | null => {
  const prefer = options.prefer ?? 'past'
  const now = options.today ?? new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const shift = (days: number) => isoDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + days))

  const text = input
    .trim()
    .toLowerCase()
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/(\d)(st|nd|rd|th)\b/g, '$1')
    .replace(/^(on|the|this) /, '')
  if (!text) return null

  // Words.
  if (['today', 'now', 'tod', 'td'].includes(text)) return shift(0)
  if (['yesterday', 'yday', 'yest', 'ytd', 'kahapon'].includes(text)) return shift(-1)
  if (['tomorrow', 'tmr', 'tmrw', 'tom', 'bukas'].includes(text)) return shift(1)
  let m = text.match(/^([+-]\d{1,3})$/)
  if (m) return shift(Number(m[1]))
  m = text.match(/^(\d{1,3}) ?(d|days?) ?ago$/)
  if (m) return shift(-Number(m[1]))
  m = text.match(/^in (\d{1,3}) ?(d|days?)$/)
  if (m) return shift(Number(m[1]))
  m = text.match(/^(last|next)? ?(sun|mon|tue|wed|thu|fri|sat)[a-z]*$/)
  if (m) {
    const target = DAYS.indexOf(m[2])
    const diff = target - today.getDay()
    const dir = m[1] === 'next' ? 'future' : m[1] === 'last' ? 'past' : prefer
    if (dir === 'past') return shift(diff <= 0 ? diff : diff - 7)
    return shift(diff >= 0 ? diff : diff + 7)
  }

  // Pick the year when none was given: nearest on the preferred side.
  const withYear = (month: number, day: number, year?: number): string | null => {
    if (year !== undefined) {
      const d = valid(fullYear(year), month, day)
      return d ? isoDay(d) : null
    }
    const thisYear = valid(today.getFullYear(), month, day)
    if (!thisYear) {
      const any = valid(today.getFullYear() + (prefer === 'past' ? -1 : 1), month, day)
      return any ? isoDay(any) : null
    }
    if (prefer === 'past' && thisYear > today) return withYear(month, day, today.getFullYear() - 1)
    if (prefer === 'future' && thisYear < today) return withYear(month, day, today.getFullYear() + 1)
    return isoDay(thisYear)
  }

  // 2026-11-16 / 2026/11/16 / 2026.11.16
  m = text.match(/^(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})$/)
  if (m) return withYear(Number(m[2]) - 1, Number(m[3]), Number(m[1]))

  // 16/11, 11/16, 16-11-2026, 11.16.26
  m = text.match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?$/)
  if (m) {
    let a = Number(m[1])
    let b = Number(m[2])
    const year = m[3] ? Number(m[3]) : undefined
    let month: number
    let day: number
    if (a > 12) [day, month] = [a, b]
    else if (b > 12) [month, day] = [a, b]
    else if (monthFirst()) [month, day] = [a, b]
    else [day, month] = [a, b]
    a = month
    b = day
    return withYear(a - 1, b, year)
  }

  // Nov 16 / November 16 2026 / 16 Nov / 16 November 26
  m = text.match(/^([a-z.]+) (\d{1,2})(?: (\d{2,4}))?$/)
  if (m && monthIndex(m[1]) >= 0) return withYear(monthIndex(m[1]), Number(m[2]), m[3] ? Number(m[3]) : undefined)
  m = text.match(/^(\d{1,2}) ([a-z.]+)(?: (\d{2,4}))?$/)
  if (m && monthIndex(m[2]) >= 0) return withYear(monthIndex(m[2]), Number(m[1]), m[3] ? Number(m[3]) : undefined)

  // "16" or "the 3rd": that day, this month (or the nearest month on the preferred side).
  m = text.match(/^(\d{1,2})$/)
  if (m) {
    const day = Number(m[1])
    for (let back = 0; back < 3; back++) {
      const offset = prefer === 'past' ? -back : back
      const d = valid(today.getFullYear(), today.getMonth() + offset, day)
      if (!d) continue
      if (prefer === 'past' && d > today) continue
      if (prefer === 'future' && d < today) continue
      return isoDay(d)
    }
  }
  return null
}

/** "Mon, 16 Nov 2026" — how a picked date is shown back. */
export const friendlyDay = (iso: string): string => {
  const [y, mo, d] = iso.split('-').map(Number)
  return new Date(y, mo - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
