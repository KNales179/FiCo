import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { updateNotificationPreferences } from '../services/authService'
import { ApiError, isNetworkError } from '../lib/api'
import {
  DEFAULT_APPEARANCE,
  PALETTES,
  applyAppearance,
  loadAppearance,
  saveAppearance,
  type Appearance,
  type Density,
  type FontSize,
  type ThemeMode,
} from '../features/theme'
import type { NotificationPreferences } from '../types/auth'
import { PageHeader, Card, Button, Alert } from '../components/ui'
import { IconBell, IconCheck, IconPalette, IconSlidersHorizontal } from '../components/icons'

const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ')

/** A small segmented control — used for theme mode, font size, and density. */
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
            ? 'bg-brand text-brand-ink shadow-sm'
            : 'text-muted hover:text-ink',
        )}
      >
        {option.label}
      </button>
    ))}
  </div>
)

/** An accessible on/off switch. The inner check mark keeps "on" unambiguous
 * even for someone who can't rely on the color difference alone. */
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
      'relative h-7 w-12 shrink-0 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50',
      checked ? 'border-brand bg-brand' : 'border-line bg-panel-2',
    )}
  >
    <span
      className={cx(
        'absolute top-0.5 flex h-5.5 w-5.5 items-center justify-center rounded-full bg-white shadow transition-transform',
        checked ? 'translate-x-[22px] text-brand' : 'translate-x-0.5 text-transparent',
      )}
    >
      <IconCheck size={13} />
    </span>
  </button>
)

const PAGE_SIZE_CHOICES = [10, 25, 50, 100, 200]

const AppearanceSection = () => {
  const [appearance, setAppearance] = useState<Appearance>(loadAppearance)

  const change = (next: Appearance) => {
    setAppearance(next)
    applyAppearance(next)
    saveAppearance(next)
  }

  const isDefault =
    appearance.theme === DEFAULT_APPEARANCE.theme &&
    appearance.palette === DEFAULT_APPEARANCE.palette &&
    appearance.fontSize === DEFAULT_APPEARANCE.fontSize &&
    appearance.density === DEFAULT_APPEARANCE.density &&
    appearance.defaultPageSize === DEFAULT_APPEARANCE.defaultPageSize

  return (
    <Card>
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-brand">
          <IconPalette size={17} />
        </span>
        <div>
          <h2 className="section-title">Appearance</h2>
          <p className="text-xs text-muted">
            Saved to this device — everyone in your Finance can pick their own.
          </p>
        </div>
      </div>

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
                  'flex items-center gap-2 rounded-lg border-2 px-2.5 py-1.5 text-sm font-medium transition-colors',
                  appearance.palette === p.value
                    ? 'border-current bg-panel-2'
                    : 'border-line hover:bg-panel-2',
                )}
                style={appearance.palette === p.value ? { color: p.swatch } : undefined}
              >
                <span
                  aria-hidden="true"
                  className="flex h-4.5 w-4.5 items-center justify-center rounded-full border border-black/10"
                  style={{ backgroundColor: p.swatch }}
                >
                  {appearance.palette === p.value && (
                    <IconCheck size={11} className="text-white" />
                  )}
                </span>
                <span className="text-ink">{p.label}</span>
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

        <div>
          <span className="field-label">Density</span>
          <Segmented<Density>
            value={appearance.density}
            onChange={(density) => change({ ...appearance, density })}
            options={[
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'compact', label: 'Compact' },
            ]}
          />
          <p className="mt-1 text-xs text-muted">
            Compact tightens table and list rows — handy for a long Records list.
          </p>
        </div>

        <div>
          <span className="field-label">Records list opens with</span>
          <Segmented<string>
            value={String(appearance.defaultPageSize)}
            onChange={(n) => change({ ...appearance, defaultPageSize: Number(n) })}
            options={PAGE_SIZE_CHOICES.map((n) => ({ value: String(n), label: String(n) }))}
          />
          <p className="mt-1 text-xs text-muted">
            Still changeable per visit from the Records list itself.
          </p>
        </div>

        {!isDefault && (
          <Button size="sm" onClick={() => change(DEFAULT_APPEARANCE)}>
            Reset to default
          </Button>
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
      setError(
        isNetworkError(err)
          ? "Couldn't reach the server — try again once you're back online."
          : err instanceof ApiError && err.status === 404
            ? "This server doesn't have that setting yet — it may still be starting up. Try again shortly."
            : err instanceof Error
              ? err.message
              : 'Could not save that',
      )
    } finally {
      setBusyKey(null)
    }
  }

  const visible = NOTIFICATION_CATEGORIES.filter(
    (c) => !c.adminOnly || user?.role === 'ADMIN',
  )

  return (
    <Card>
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-brand">
          <IconBell size={17} />
        </span>
        <div>
          <h2 className="section-title">Notifications</h2>
          <p className="text-xs text-muted">
            Mute what you don't need — push still needs turning on for this
            device, on the Account page.
          </p>
        </div>
      </div>
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
      <PageHeader
        title="Settings"
        description="How Fico looks and speaks up, on this device."
        actions={
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-brand">
            <IconSlidersHorizontal size={18} />
          </span>
        }
      />
      <AppearanceSection />
      <NotificationsSection />
    </div>
  )
}

export default Settings
