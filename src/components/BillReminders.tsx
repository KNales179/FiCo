import { useMemo, useState } from 'react'
import { useBills } from '../hooks/useBills'
import { dueSoonBills } from '../domain/bills'

/**
 * "Bills due soon" banner (Roadmap: in-app notifications, tier 1) — shown
 * across every page since it's meant to catch your eye, not just live on
 * the Bills page. Dismissing one only hides it for the rest of this visit;
 * it comes back next time you open the app unless the bill actually gets
 * paid (which moves its due date and drops it off the list on its own).
 */
const BillReminders = () => {
  const { bills } = useBills()
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const reminders = useMemo(
    () => dueSoonBills(bills, new Date().toISOString()),
    [bills],
  )
  const visible = reminders.filter((r) => !dismissed.has(r.billId))

  if (visible.length === 0) return null

  return (
    <div className="border-b border-line bg-warning/10 px-4 py-2">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-1.5">
        {visible.map((r) => (
          <span
            key={r.billId}
            className="inline-flex items-center gap-1.5 rounded-full bg-panel px-2.5 py-1 text-xs"
          >
            <span className={r.overdue ? 'font-medium text-danger' : 'font-medium text-warning'}>
              {r.overdue ? 'Overdue' : 'Due soon'}
            </span>
            {r.name} — {new Date(r.dueDate).toLocaleDateString()}
            <button
              type="button"
              onClick={() =>
                setDismissed((prev) => new Set(prev).add(r.billId))
              }
              aria-label={`Dismiss ${r.name} reminder`}
              className="text-muted hover:text-ink"
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}

export default BillReminders
