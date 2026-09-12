import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { updateNotificationPreferences } from '../services/authService'
import {
  DEFAULT_APPEARANCE,
  PALETTES,
  applyAppearance,
  loadAppearance,
  saveAppearance,
  type Appearance,
  type FontSize,
  type ThemeMode,
} from '../features/theme'
import type { NotificationPreferences } from '../types/auth'
import { PageHeader, Card, Alert } from '../components/ui'

const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ')

/** A small segmented control — used for theme mode and font size, both 2-3 choices. */
const Segmented = <T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) => (
  <div className="inline-flex rounded-lg border border-line bg-panel-2 p-0.5">
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        onClick={() => onChange(option.value)}
        aria-pressed={value === option.value}
        className={cx(
          'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          value === option.value
            ? 'bg-panel text-ink shadow-sm'
            : 'text-muted hover:text-ink',
        )}
      >
        {option.label}
      </button>
    ))}
  </div>
)

/** An accessible on/off switch — brand color only when on, per the app's "use it sparingly" rule. */
const Switch = ({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label: string
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={cx(
      'relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50',
      checked ? 'border-brand bg-brand' : 'border-line bg-panel-2',
    )}
  >
    <span
      className={cx(
        'absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-transform',
        checked ? 'translate-x-[22px]' : 'translate-x-0.5',
      )}
    />
  </button>
)

const AppearanceSection = () => {
  const [appearance, setAppearance] = useState<Appearance>(loadAppearance)

  const change = (next: Appearance) => {
    setAppearance(next)
    applyAppearance(next)
    saveAppearance(next)
  }

  return (
    <Card>
      <h2 className="section-title">Appearance</h2>
      <p className="mt-1 text-xs text-muted">
        Saved to this device — everyone in your Finance can pick their own.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <span className="field-label">Theme</span>
          <Segmented<ThemeMode>
            value={appearance.theme}
            onChange={(theme) => change({ ...appearance, theme })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </div>

        <div>
          <span className="field-label">Color palette</span>
          <div className="flex flex-wrap gap-2">
            {PALETTES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => change({ ...appearance, palette: p.value })}
                aria-pressed={appearance.palette === p.value}
                title={p.label}
                className={cx(
                  'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition-colors',
                  appearance.palette === p.value
                    ? 'border-ink/30 bg-panel-2'
                    : 'border-line hover:bg-panel-2',
                )}
              >
                <span
                  aria-hidden="true"
                  className="h-4 w-4 rounded-full border border-black/10"
                  style={{ backgroundColor: p.swatch }}
                />
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="field-label">Text size</span>
          <Segmented<FontSize>
            value={appearance.fontSize}
            onChange={(fontSize) => change({ ...appearance, fontSize })}
            options={[
              { value: 'sm', label: 'Small' },
              { value: 'md', label: 'Medium' },
              { value: 'lg', label: 'Large' },
            ]}
          />
        </div>

        {(appearance.theme !== DEFAULT_APPEARANCE.theme ||
          appearance.palette !== DEFAULT_APPEARANCE.palette ||
          appearance.fontSize !== DEFAULT_APPEARANCE.fontSize) && (
          <button
            type="button"
            onClick={() => change(DEFAULT_APPEARANCE)}
            className="text-xs text-muted underline"
          >
            Reset to default
          </button>
        )}
      </div>
    </Card>
  )
}

const NOTIFICATION_CATEGORIES: {
  key: keyof NotificationPreferences
  label: string
  hint: string
  adminOnly?: boolean
}[] = [
  {
    key: 'billReminders',
    label: 'Bill due reminders',
    hint: "A bill of yours is coming due, or overdue.",
  },
  {
    key: 'shoppingUpdates',
    label: 'Shopping list activity',
    hint: 'Someone else in your Finance starts a shopping list.',
  },
  {
    key: 'billUpdates',
    label: 'Bill activity',
    hint: 'Someone else adds a bill, or pays one.',
  },
  {
    key: 'accountActivity',
    label: 'Account activity',
    hint: "Someone else records a transaction on an account you added.",
  },
  {
    key: 'feedbackReports',
    label: 'New feedback reports',
    hint: 'Someone submits a bug report or suggestion.',
    adminOnly: true,
  },
]

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  billReminders: true,
  shoppingUpdates: true,
  billUpdates: true,
  accountActivity: true,
  feedbackReports: true,
}

const NotificationsSection = () => {
  const { user, refreshUser } = useAuth()
  const [prefs, setPrefs] = useState<NotificationPreferences>(
    user?.notificationPreferences ?? DEFAULT_NOTIFICATION_PREFERENCES,
  )
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState('')

  const toggle = async (key: keyof NotificationPreferences, next: boolean) => {
    setError('')
    const previous = prefs
    setPrefs({ ...prefs, [key]: next })
    setBusyKey(key)
    try {
      await updateNotificationPreferences({ [key]: next })
      await refreshUser()
    } catch (err) {
      setPrefs(previous)
      setError(err instanceof Error ? err.message : 'Could not save that')
    } finally {
      setBusyKey(null)
    }
  }

  const visible = NOTIFICATION_CATEGORIES.filter(
    (c) => !c.adminOnly || user?.role === 'ADMIN',
  )

  return (
    <Card>
      <h2 className="section-title">Notifications</h2>
      <p className="mt-1 text-xs text-muted">
        Mute what you don't need — push notifications still need to be turned
        on for this device on the Account page.
      </p>
      {error && (
        <div className="mt-2">
          <Alert>{error}</Alert>
        </div>
      )}
      <ul className="mt-3 divide-y divide-line">
        {visible.map((c) => (
          <li key={c.key} className="flex items-center justify-between gap-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-ink">{c.label}</p>
              <p className="text-xs text-muted">{c.hint}</p>
            </div>
            <Switch
              checked={prefs[c.key]}
              disabled={busyKey === c.key}
              onChange={(next) => void toggle(c.key, next)}
              label={c.label}
            />
          </li>
        ))}
      </ul>
    </Card>
  )
}

const Settings = () => {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Settings" description="How Fico looks and speaks up, on this device." />
      <AppearanceSection />
      <NotificationsSection />
    </div>
  )
}

export default Settings
