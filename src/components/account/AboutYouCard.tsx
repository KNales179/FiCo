import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { updateMe } from '../../services/authService'
import { isNetworkError } from '../../lib/api'
import { Alert, Button } from '../ui'
import CollapsibleCard from '../CollapsibleCard'
import { IconCalendar, IconCheck, IconSparkles, IconWallet } from '../icons'
import {
  daysInMonth,
  daysUntil,
  formatDay,
  isBirthdayToday,
  monthName,
  nextBirthday,
  paydayLabel,
  ABOUT_SECTION_ID,
} from '../../features/profile'

type PayPattern = 'none' | 'monthly' | 'twice'

const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1)

/**
 * "About you" — optional: birthday and paydays. Fico only uses the birthday and paydays for this person —
 * a birthday greeting and friendlier budget hints — and never shows them to
 * other members.
 */
const AboutYouCard = () => {
  const { user, refreshUser } = useAuth()

  const [bMonth, setBMonth] = useState(user?.birthday?.month ? String(user.birthday.month) : '')
  const [bDay, setBDay] = useState(user?.birthday?.day ? String(user.birthday.day) : '')
  const [bYear, setBYear] = useState(user?.birthday?.year ? String(user.birthday.year) : '')
  const initialPaydays = user?.paydays ?? []
  const hasAny = Boolean(user?.birthday) || initialPaydays.length > 0
  const [pattern, setPattern] = useState<PayPattern>(
    initialPaydays.length >= 2 ? 'twice' : initialPaydays.length === 1 ? 'monthly' : 'none',
  )
  const [pay1, setPay1] = useState(String(initialPaydays[0] ?? 15))
  const [pay2, setPay2] = useState(String(initialPaydays[1] ?? 31))

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  // Days offered follow the month picked (Feb allows 29 — leap-day birthdays exist).
  const maxDay = bMonth ? daysInMonth(2024, Number(bMonth)) : 31
  const birthday =
    bMonth && bDay ? { month: Number(bMonth), day: Math.min(Number(bDay), maxDay), year: bYear ? Number(bYear) : null } : null
  const next = birthday ? nextBirthday(birthday) : null
  const thisYear = new Date().getFullYear()

  const paydays =
    pattern === 'none' ? [] : pattern === 'monthly' ? [Number(pay1)] : [Number(pay1), Number(pay2)]

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSaved(false)
    if ((bMonth && !bDay) || (!bMonth && bDay)) {
      setError('Pick both the month and the day of your birthday — or leave both empty.')
      return
    }
    if (bYear && (!/^\d{4}$/.test(bYear) || Number(bYear) < 1900 || Number(bYear) > thisYear)) {
      setError(`Birth year should be between 1900 and ${thisYear} — or leave it empty.`)
      return
    }
    setBusy(true)
    try {
      await updateMe({
        birthday,
        paydays,
      })
      await refreshUser()
      setSaved(true)
    } catch (err) {
      setError(
        isNetworkError(err)
          ? 'Saving your profile needs a connection — try again once you’re online.'
          : err instanceof Error
            ? err.message
            : 'Could not save your profile',
      )
    } finally {
      setBusy(false)
    }
  }

  const dayPicker = (value: string, onChange: (v: string) => void, label: string) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="select w-auto min-w-[7.5rem]" aria-label={label}>
      {DAY_OPTIONS.map((d) => (
        <option key={d} value={d}>
          {d === 31 ? 'Last day' : paydayLabel(d)}
        </option>
      ))}
    </select>
  )

  return (
    <div id={ABOUT_SECTION_ID} className="scroll-mt-24">
    <CollapsibleCard
      id={ABOUT_SECTION_ID}
      icon={IconSparkles}
      title={
        <span className="flex items-center gap-2">
          About you
          <span className="rounded-full bg-panel-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
            Optional
          </span>
        </span>
      }
      subtitle={hasAny ? undefined : 'Birthday & payday'}
      defaultOpen={hasAny}
    >
      <p className="text-xs text-muted">
        Totally up to you — skip it and nothing changes. If you add them, only you see your birthday and
        paydays: Fico uses them to greet you on your day and to make your budget hints feel a little more
        like you.
      </p>

      <form onSubmit={submit} className="mt-4 space-y-4">
        <fieldset className="rounded-xl border border-line p-3">
          <legend className="flex items-center gap-1.5 px-1 text-sm font-semibold text-ink">
            <IconCalendar size={15} /> Birthday
          </legend>
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2">
            <select value={bMonth} onChange={(e) => setBMonth(e.target.value)} className="select" aria-label="Birth month">
              <option value="">Month</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {monthName(i + 1)}
                </option>
              ))}
            </select>
            <select value={bDay} onChange={(e) => setBDay(e.target.value)} className="select" aria-label="Birth day">
              <option value="">Day</option>
              {Array.from({ length: maxDay }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
            <input
              value={bYear}
              onChange={(e) => setBYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              placeholder="Year"
              aria-label="Birth year (optional)"
              className="input"
            />
          </div>
          <p className="mt-2 text-xs text-muted">
            {birthday && next
              ? isBirthdayToday(birthday)
                ? 'That’s today — happy birthday!'
                : `Next one: ${formatDay(next)} — in ${daysUntil(next)} day${daysUntil(next) === 1 ? '' : 's'}.`
              : 'The year is optional — leave it out if you’d rather not say.'}
          </p>
          {(bMonth || bDay || bYear) && (
            <button
              type="button"
              onClick={() => {
                setBMonth('')
                setBDay('')
                setBYear('')
              }}
              className="mt-1 text-xs text-muted underline hover:text-ink"
            >
              Clear birthday
            </button>
          )}
        </fieldset>

        <fieldset className="rounded-xl border border-line p-3">
          <legend className="flex items-center gap-1.5 px-1 text-sm font-semibold text-ink">
            <IconWallet size={15} /> Payday
          </legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="How often you get paid">
            {(
              [
                ['none', 'Not fixed'],
                ['monthly', 'Once a month'],
                ['twice', 'Twice a month'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={pattern === value}
                onClick={() => setPattern(value)}
                className={[
                  'rounded-full border px-3 py-1.5 text-sm transition-colors',
                  pattern === value ? 'border-brand bg-brand text-brand-ink' : 'border-line text-muted hover:text-ink',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
          {pattern !== 'none' && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span>On the</span>
              {dayPicker(pay1, setPay1, 'Payday')}
              {pattern === 'twice' && (
                <>
                  <span>and the</span>
                  {dayPicker(pay2, setPay2, 'Second payday')}
                </>
              )}
            </div>
          )}
          <p className="mt-2 text-xs text-muted">
            {pattern === 'none'
              ? 'Freelance, commission, or it just varies? That’s fine — leave it here.'
              : 'Fico uses this to time its budget hints around when money comes in.'}
          </p>
        </fieldset>

        {error && <Alert>{error}</Alert>}
        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-success">
              <IconCheck size={15} /> Saved
            </span>
          )}
        </div>
      </form>
    </CollapsibleCard>
    </div>
  )
}

export default AboutYouCard
