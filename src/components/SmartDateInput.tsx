import { useRef, useState } from 'react'
import { friendlyDay, parseLooseDate } from '../domain/looseDate'
import { IconCalendar } from './icons'

/**
 * A date field that accepts however you type a date (Postel's law):
 * "today", "yesterday", "Nov 16", "16/11", "the 3rd", "3 days ago",
 * "last friday", "2026-11-16"… The calendar button still opens the
 * device's own date picker. The value stays "YYYY-MM-DD" (or "" when
 * empty), exactly like a native date input, so it drops in anywhere.
 */
const SmartDateInput = ({
  value,
  onChange,
  min,
  max,
  prefer = 'past',
  className = '',
  'aria-label': ariaLabel = 'Date',
  title,
}: {
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  /** With no year given: the nearest date before today (a record) or after (a bill). */
  prefer?: 'past' | 'future'
  className?: string
  'aria-label'?: string
  title?: string
}) => {
  const [typing, setTyping] = useState<string | null>(null)
  const [problem, setProblem] = useState('')
  const picker = useRef<HTMLInputElement>(null)

  const commit = (text: string) => {
    if (!text.trim()) {
      setProblem('')
      setTyping(null)
      onChange('')
      return
    }
    const iso = parseLooseDate(text, { prefer })
    if (!iso) {
      setProblem('Try “today”, “Nov 16” or “16/11”')
      return
    }
    if (max && iso > max) {
      setProblem('That’s in the future')
      return
    }
    if (min && iso < min) {
      setProblem('That’s too early')
      return
    }
    setProblem('')
    setTyping(null)
    onChange(iso)
  }

  const shown = typing ?? (value ? friendlyDay(value) : '')
  return (
    <span className={`relative inline-flex min-w-[11rem] flex-col ${className}`}>
      <span className="relative flex">
        <input
          type="text"
          inputMode="text"
          value={shown}
          placeholder="today, Nov 16…"
          aria-label={ariaLabel}
          aria-invalid={Boolean(problem)}
          title={title ?? 'Type a date any way you like — “yesterday”, “Nov 16”, “16/11” — or use the calendar'}
          onFocus={(e) => {
            setTyping(value ? friendlyDay(value) : '')
            requestAnimationFrame(() => e.target.select())
          }}
          onChange={(e) => {
            setTyping(e.target.value)
            if (problem) setProblem('')
          }}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit((e.target as HTMLInputElement).value)
            } else if (e.key === 'Escape') {
              setTyping(null)
              setProblem('')
            }
          }}
          className={`input w-full pr-10 ${problem ? 'border-danger' : ''}`}
        />
        <button
          type="button"
          aria-label="Pick from a calendar"
          title="Pick from a calendar"
          onClick={() => {
            const el = picker.current
            if (!el) return
            try {
              el.showPicker()
            } catch {
              el.focus()
              el.click()
            }
          }}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted hover:text-brand"
        >
          <IconCalendar size={16} />
        </button>
        {/* The device's own calendar, opened by the button above. */}
        <input
          ref={picker}
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          value={value}
          min={min}
          max={max}
          onChange={(e) => {
            setProblem('')
            setTyping(null)
            onChange(e.target.value)
          }}
          className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
        />
      </span>
      {problem && (
        <span role="alert" className="mt-1 text-xs font-medium text-danger">
          {problem}
        </span>
      )}
    </span>
  )
}

export default SmartDateInput
