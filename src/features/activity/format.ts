import { FIELD_LABEL, KIND_LABEL, fieldValue } from '../sync/describe'
import { USAGE, type UsageKind } from '../bills/usage'

/**
 * Turning the server's activity entries into plain language: "added a
 * record "Lunch"" instead of "added transaction "Lunch"", and each edit's
 * before → after with names instead of ids.
 */

export type ActivityTab = 'records' | 'members' | 'conflicts'
export type RecordKind = '' | 'money' | 'bills' | 'tobuy' | 'planning'

export const RECORD_KINDS: Array<{ value: RecordKind; label: string }> = [
  { value: '', label: 'Everything' },
  { value: 'money', label: 'Money' },
  { value: 'bills', label: 'Bills' },
  { value: 'tobuy', label: 'To-buy lists' },
  { value: 'planning', label: 'Budget & categories' },
]

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

const WORDS: Record<string, string> = {
  ...Object.fromEntries(Object.entries(KIND_LABEL).map(([k, v]) => [k, lower(v)])),
  ...Object.fromEntries(Object.entries(FIELD_LABEL).map(([k, v]) => [k, lower(v)])),
}
const WORD_RE = new RegExp(`\\b(${Object.keys(WORDS).join('|')})\\b`, 'g')

/** Swap internal names for everyday words — never inside quoted names people typed. */
export const friendlySummary = (summary: string) =>
  summary
    .split('"')
    .map((part, i) => (i % 2 === 1 ? part : part.replace(WORD_RE, (w) => WORDS[w] ?? w)))
    .join('"')

/** Ids that only matter to the app, not to a person reading the log. */
const hiddenField = (field: string) => field.endsWith('Id') && field !== 'accountId' && field !== 'categoryId' && field !== 'destinationAccountId'

const humanize = (field: string) =>
  field
    .replace(/Minor$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase())

export interface ChangeLine {
  label: string
  from: string
  to: string
}

export const describeChange = (
  change: { field: string; from: unknown; to: unknown },
  ctx: { currency?: string; accounts: Map<string, string>; categories: Map<string, string> },
): ChangeLine | null => {
  const { field } = change
  if (hiddenField(field)) return null
  const value = (v: unknown): string => {
    if (v === '(changed)') return 'changed'
    if (v === null || v === undefined || v === '') return '—'
    if (field === 'accountId' || field === 'destinationAccountId') return ctx.accounts.get(String(v)) ?? 'a removed account'
    if (field === 'categoryId') return ctx.categories.get(String(v)) ?? 'a removed category'
    if (field === 'usageKind') return USAGE[v as UsageKind]?.label ?? String(v)
    if (field === 'status') return lower(String(v))
    return fieldValue(field, v, ctx.currency)
  }
  return { label: FIELD_LABEL[field] ?? humanize(field), from: value(change.from), to: value(change.to) }
}

/** "Today", "Yesterday", or "Nov 12" — the day headings in the list. */
export const dayLabel = (iso: string, now = new Date()) => {
  const d = new Date(iso)
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((start(now) - start(d)) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  })
}
