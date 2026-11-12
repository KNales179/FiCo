import { useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { birthdayBudgetNudge, suggestTreatMinor } from '../../features/profile'
import { formatMoney, parseAmountToMinor } from '../../domain/money'
import type { BudgetPlanItem } from '../../types/models'
import { Button } from '../ui'
import { IconCheck, IconSparkles, IconX } from '../icons'

const TREAT_NAME = 'Birthday treat'

const dismissKey = (period: string) => `fico.birthdayNudgeDismissed.${period}`

const wasDismissed = (period: string) => {
  try {
    return localStorage.getItem(dismissKey(period)) === '1'
  } catch {
    return false
  }
}

/**
 * Shown on the Budget page while planning the month that holds the signed-in
 * person's birthday (from Account → About you): a warm nudge to set a little
 * aside to treat themselves, with a suggested amount they can change and
 * add to "Other planned expenses" in one tap. Dismissible per month.
 */
const BirthdayBudgetCard = ({
  period,
  incomeMinor,
  plannedItems,
  onAdd,
  canEdit,
}: {
  period: string
  incomeMinor: number
  plannedItems: BudgetPlanItem[]
  onAdd: (name: string, amountMinor: number) => void
  canEdit: boolean
}) => {
  const { user } = useAuth()
  const [dismissedFor, setDismissedFor] = useState<string | null>(null)
  const suggestion = suggestTreatMinor(incomeMinor)
  const [amount, setAmount] = useState<string | null>(null)

  const nudge = useMemo(
    () =>
      user?.birthday
        ? birthdayBudgetNudge({
            birthday: user.birthday,
            period,
            name: user.displayName?.split(' ')[0] || user.username,
            paydays: user.paydays ?? [],
          })
        : null,
    [user, period],
  )

  if (!nudge || dismissedFor === period || wasDismissed(period)) return null

  const added = plannedItems.find((i) => i.name === TREAT_NAME)
  const amountText = amount ?? (suggestion / 100).toFixed(0)

  const dismiss = () => {
    try {
      localStorage.setItem(dismissKey(period), '1')
    } catch {
      // Fine — it just hides for now.
    }
    setDismissedFor(period)
  }

  const add = () => {
    const minor = parseAmountToMinor(amountText)
    if (minor === null || minor <= 0) return
    onAdd(TREAT_NAME, minor)
  }

  return (
    <section className="birthday-card relative overflow-hidden rounded-[var(--radius-card)] border border-line p-4 sm:p-5">
      <span className="birthday-confetti" aria-hidden="true" />
      <button
        type="button"
        onClick={dismiss}
        aria-label="Hide for this month"
        title="Hide for this month"
        className="absolute right-3 top-3 z-10 rounded-full bg-panel/80 p-1 text-muted hover:bg-panel-2 hover:text-ink"
      >
        <IconX size={16} />
      </button>
      <div className="relative flex gap-3 pr-6">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-ink shadow-sm">
          <IconSparkles size={20} />
        </span>
        <div className="min-w-0 space-y-1.5">
          <h2 className="text-base font-bold text-ink">{nudge.title}</h2>
          <p className="text-sm text-muted">{nudge.body}</p>
          {nudge.paydayNote && <p className="text-sm text-muted">{nudge.paydayNote}</p>}

          {added ? (
            <p className="flex items-center gap-1.5 pt-1 text-sm font-medium text-success">
              <IconCheck size={15} /> {formatMoney(added.amountMinor)} for your birthday treat is in the plan. Enjoy it!
            </p>
          ) : canEdit ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <label className="flex items-center gap-2 text-sm text-muted">
                Treat budget
                <input
                  value={amountText}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  className="input w-28"
                  aria-label="Birthday treat amount"
                />
              </label>
              <Button size="sm" variant="primary" onClick={add}>
                Add to my plan
              </Button>
              <span className="w-full text-xs text-muted">
                Suggested {formatMoney(suggestion)}
                {incomeMinor > 0 ? ' — about 5% of the month’s income.' : '.'} Change it to whatever feels right.
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export default BirthdayBudgetCard
