import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import ColorWheel from '../components/ColorWheel'
import { HEX_RE, wheelColor, wheelPosition } from '../features/theme/color'
import { useSpace } from '../hooks/useSpace'
import { useDisplayCurrency } from '../hooks/useDisplayCurrency'
import { updateNotificationPreferences } from '../services/authService'
import { ApiError, isNetworkError } from '../lib/api'
import { gsap, prefersReducedMotion } from '../lib/motion'
import { SUPPORTED_CURRENCIES, currencyName, formatMoney, minorPerMajor } from '../domain/money'
import {
  DEFAULT_APPEARANCE,
  FONTS,
  PALETTES,
  applyAppearance,
  loadAppearance,
  saveAppearance,
  type Appearance,
  type Density,
  type FontGroup,
  type FontSize,
  type ThemeMode,
} from '../features/theme'
import type { NotificationPreferences } from '../types/auth'
import { PageHeader, Card, Button, Alert, Select, Switch } from '../components/ui'
import PushControl from '../components/settings/PushControl'
import FinanceCurrency from '../components/settings/FinanceCurrency'
import {
  IconBell,
  IconCheck,
  IconPalette,
  IconSettings,
  IconWallet,
  type IconProps,
} from '../components/icons'

const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ')

type Tab = 'look' | 'text' | 'currency' | 'notifications'

const TABS: { id: Tab; label: string; hint: string; icon: ComponentType<IconProps> }[] = [
  { id: 'look', label: 'Look', hint: 'Light or dark, and your colour', icon: IconPalette },
  { id: 'text', label: 'Text', hint: 'Font, size and spacing', icon: IconSettings },
  { id: 'currency', label: 'Currency', hint: 'Your view, and the Finance’s', icon: IconWallet },
  { id: 'notifications', label: 'Notifications', hint: 'What Fico tells you about', icon: IconBell },
]

/** A small segmented control — theme mode, text size, density. */
const Segmented = <T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) => (
  <div className="inline-flex flex-wrap rounded-lg border border-line bg-panel-2 p-0.5">
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        onClick={() => onChange(option.value)}
        aria-pressed={value === option.value}
        className={cx(
          'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          value === option.value ? 'bg-brand text-brand-ink shadow-sm' : 'text-muted hover:text-ink',
        )}
      >
        {option.label}
      </button>
    ))}
  </div>
)

/**
 * One setting: what it is and what it does on the left (or on top, on a
 * phone), the control beside it — so nobody has to guess what a control
 * is for.
 */
const Row = ({
  title,
  hint,
  children,
  stacked = false,
}: {
  title: string
  hint?: ReactNode
  children: ReactNode
  stacked?: boolean
}) => (
  <div
    className={cx(
      'gap-3 py-4 first:pt-0 last:pb-0',
      stacked ? 'space-y-3' : 'flex flex-col sm:flex-row sm:items-center sm:justify-between',
    )}
  >
    <div className="min-w-0">
      <p className="text-sm font-semibold text-ink">{title}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
    <div className={stacked ? '' : 'shrink-0'}>{children}</div>
  </div>
)

const useAppearance = () => {
  const [appearance, setAppearance] = useState<Appearance>(loadAppearance)
  const change = (patch: Partial<Appearance>) => {
    const next = { ...appearance, ...patch }
    setAppearance(next)
    applyAppearance(next)
    saveAppearance(next)
  }
  return [appearance, change] as const
}

// ---------------------------------------------------------------------------

const LookTab = () => {
  const [appearance, change] = useAppearance()
  return (
    <Card data-tour="settings-appearance" className="divide-y divide-line">
      <Row title="Theme" hint="System follows your phone or computer. The sun/moon button in the top bar switches too.">
        <Segmented<ThemeMode>
          value={appearance.theme}
          onChange={(theme) => change({ theme })}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </Row>
      <Row title="Colour" hint="The accent used for buttons, highlights and the background tint." stacked>
        <div className="flex flex-wrap gap-2">
          {PALETTES.map((p) => {
            const selected = appearance.palette === p.value
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => change({ palette: p.value })}
                aria-pressed={selected}
                title={p.label}
                className={cx(
                  'flex items-center gap-2 rounded-lg border-2 px-2.5 py-1.5 text-sm font-medium transition-colors',
                  selected ? 'border-current bg-panel-2' : 'border-line hover:bg-panel-2',
                )}
                style={selected ? { color: p.swatch } : undefined}
              >
                <span
                  aria-hidden="true"
                  className="flex h-4.5 w-4.5 items-center justify-center rounded-full border border-black/10"
                  style={{ backgroundColor: p.swatch }}
                >
                  {selected && <IconCheck size={11} className="text-white" />}
                </span>
                <span className="text-ink">{p.label}</span>
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => change({ palette: 'custom', customColor: appearance.customColor ?? '#9333ea' })}
            aria-pressed={appearance.palette === 'custom'}
            title="Any colour you like"
            className={cx(
              'flex items-center gap-2 rounded-lg border-2 px-2.5 py-1.5 text-sm font-medium transition-colors',
              appearance.palette === 'custom' ? 'border-brand bg-panel-2' : 'border-line hover:bg-panel-2',
            )}
          >
            <span
              aria-hidden="true"
              className="h-4.5 w-4.5 rounded-full border border-black/10"
              style={{ background: 'conic-gradient(#f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}
            />
            <span className="text-ink">Custom</span>
          </button>
        </div>
        {appearance.palette === 'custom' && (
          <CustomColour value={appearance.customColor ?? '#9333ea'} onChange={(customColor) => change({ palette: 'custom', customColor })} />
        )}
      </Row>
    </Card>
  )
}

/** Settings → Colour → Custom: the wheel, plus a box to type a colour code. */
const CustomColour = ({ value, onChange }: { value: string; onChange: (hex: string) => void }) => {
  const [typed, setTyped] = useState(value)
  const pos = wheelPosition(value)
  return (
    <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <ColorWheel
        hue={pos.hue}
        sat={pos.sat}
        className="w-44"
        onPick={(h, s) => {
          const hex = wheelColor(h, s)
          setTyped(hex)
          onChange(hex)
        }}
      />
      <div className="space-y-2 text-sm">
        <label className="block">
          <span className="field-label">Colour code</span>
          <input
            value={typed}
            onChange={(e) => {
              const v = e.target.value.trim()
              setTyped(v)
              const hex = v.startsWith('#') ? v : `#${v}`
              if (HEX_RE.test(hex)) onChange(hex.toLowerCase())
            }}
            maxLength={7}
            spellCheck={false}
            className="input w-32 font-mono uppercase"
            aria-label="Colour code, like #3858FF"
          />
        </label>
        <p className="max-w-[16rem] text-xs text-muted">
          Drag on the wheel or type a code. Fico adjusts it a little in light or dark mode when needed, so text stays readable.
        </p>
      </div>
    </div>
  )
}

const FONT_GROUPS: FontGroup[] = ['Modern', 'Professional', 'Cute', 'Classic', 'Code', 'Silly', 'System']

const TextTab = () => {
  const [appearance, change] = useAppearance()
  const isDefault =
    appearance.fontSize === DEFAULT_APPEARANCE.fontSize &&
    appearance.font === DEFAULT_APPEARANCE.font &&
    appearance.density === DEFAULT_APPEARANCE.density &&
    appearance.defaultPageSize === DEFAULT_APPEARANCE.defaultPageSize

  return (
    <div className="space-y-4">
      <Card data-tour="settings-font">
        <p className="text-sm font-semibold text-ink">Font</p>
        <p className="mt-0.5 text-xs text-muted">Each one is shown in its own style. All of them work offline.</p>
        <div className="mt-3 space-y-4">
          {FONT_GROUPS.map((group) => (
            <div key={group}>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{group}</p>
              <ul className="overflow-hidden rounded-xl border border-line">
                {FONTS.filter((f) => f.group === group).map((f) => {
                  const selected = appearance.font === f.value
                  return (
                    <li key={f.value} className="border-b border-line last:border-b-0">
                      <button
                        type="button"
                        onClick={() => change({ font: f.value })}
                        aria-pressed={selected}
                        className={cx(
                          'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                          selected ? 'bg-brand/10' : 'hover:bg-panel-2',
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cx(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                            selected ? 'border-brand bg-brand text-brand-ink' : 'border-line',
                          )}
                        >
                          {selected && <IconCheck size={11} />}
                        </span>
                        <span className="min-w-0 flex-1" style={{ fontFamily: f.stack }}>
                          <span className="block text-base font-semibold text-ink">{f.label}</span>
                          <span className="block text-xs text-muted">{f.hint}</span>
                        </span>
                        <span className="shrink-0 text-lg font-semibold text-ink" style={{ fontFamily: f.stack }}>
                          ₱1,250
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <Card className="divide-y divide-line">
        <Row title="Text size" hint="Makes everything in Fico bigger or smaller.">
          <Segmented<FontSize>
            value={appearance.fontSize}
            onChange={(fontSize) => change({ fontSize })}
            options={[
              { value: 'sm', label: 'Small' },
              { value: 'md', label: 'Medium' },
              { value: 'lg', label: 'Large' },
            ]}
          />
        </Row>
        <Row title="Row spacing" hint="Compact fits more on screen — handy for a long Records list.">
          <Segmented<Density>
            value={appearance.density}
            onChange={(density) => change({ density })}
            options={[
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'compact', label: 'Compact' },
            ]}
          />
        </Row>
        <Row title="Records shown per page" hint="How many records the dashboard list opens with.">
          <Segmented<string>
            value={String(appearance.defaultPageSize)}
            onChange={(n) => change({ defaultPageSize: Number(n) })}
            options={[10, 25, 50, 100].map((n) => ({ value: String(n), label: String(n) }))}
          />
        </Row>
        {!isDefault && (
          <div className="pt-4">
            <Button
              size="sm"
              onClick={() =>
                change({
                  font: DEFAULT_APPEARANCE.font,
                  fontSize: DEFAULT_APPEARANCE.fontSize,
                  density: DEFAULT_APPEARANCE.density,
                  defaultPageSize: DEFAULT_APPEARANCE.defaultPageSize,
                })
              }
            >
              Reset text settings
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}

const CurrencyTab = () => {
  const [appearance, change] = useAppearance()
  const { activeSpace } = useSpace()
  const { rate, target } = useDisplayCurrency()
  const base = activeSpace?.currency ?? 'PHP'
  const sample = 1000 * minorPerMajor(base)

  return (
    <div className="space-y-4">
      <Card className="divide-y divide-line" data-tour="settings-currency">
        <Row
          title="Your currency"
          hint={
            <>
              See amounts converted into the currency you think in — for example AED if you live
              abroad. <strong className="text-ink">Only you see this</strong>, on this device: it
              doesn’t change any record or what anyone else in your Finance sees.
            </>
          }
          stacked
        >
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={appearance.displayCurrency ?? ''}
              onChange={(e) => change({ displayCurrency: e.target.value || null })}
              className="w-auto"
              aria-label="Your currency"
            >
              <option value="">Off — show {base} only</option>
              {SUPPORTED_CURRENCIES.filter((c) => c !== base).map((c) => (
                <option key={c} value={c}>
                  {c} — {currencyName(c)}
                </option>
              ))}
            </Select>
            {target && (
              <span className="text-sm text-muted">
                {rate != null
                  ? `${formatMoney(sample, base)} ≈ ${formatMoney(Math.round((sample / minorPerMajor(base)) * rate * minorPerMajor(target)), target)}`
                  : 'Getting today’s rate…'}
              </span>
            )}
          </div>
          {target && (
            <p className="text-xs text-muted">
              Converted amounts show as a small “≈” line under totals and records. They’re
              approximate, using a daily exchange rate (the last known one when you’re offline).
            </p>
          )}
        </Row>
      </Card>

      {activeSpace && (
        <Card>
          <p className="text-sm font-semibold text-ink">{activeSpace.name}’s currency</p>
          <p className="mt-0.5 text-xs text-muted">
            {activeSpace.type === 'FAMILY'
              ? 'Shared by everyone in this Finance — new accounts start in it. '
              : 'New accounts in this Finance start in it. '}
            Accounts can still use a different currency; Fico converts at today’s rate when money
            moves between them.
          </p>
          <div className="mt-3">
            <FinanceCurrency />
          </div>
        </Card>
      )}
    </div>
  )
}

const NOTIFICATION_CATEGORIES: {
  key: keyof NotificationPreferences
  label: string
  hint: string
  adminOnly?: boolean
}[] = [
  { key: 'billReminders', label: 'Bill due reminders', hint: 'A bill of yours is coming due, or overdue.' },
  { key: 'shoppingUpdates', label: 'To-buy list activity', hint: 'Someone else in your Finance starts a to-buy list.' },
  { key: 'billUpdates', label: 'Bill activity', hint: 'Someone else adds a bill, or pays one.' },
  { key: 'accountActivity', label: 'Account activity', hint: 'Someone else records a transaction on an account you added.' },
  { key: 'feedbackReports', label: 'New feedback reports', hint: 'Someone submits a bug report or suggestion.', adminOnly: true },
]

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  billReminders: true,
  shoppingUpdates: true,
  billUpdates: true,
  accountActivity: true,
  feedbackReports: true,
}

const NotificationsTab = () => {
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

  const visible = NOTIFICATION_CATEGORIES.filter((c) => !c.adminOnly || user?.role === 'ADMIN')

  return (
    <Card data-tour="settings-notifications">
      <PushControl />
      <p className="mt-4 text-sm font-semibold text-ink">What to tell you about</p>
      <p className="mt-0.5 text-xs text-muted">Mute what you don’t need. Saved to your account.</p>
      {error && (
        <div className="mt-2">
          <Alert>{error}</Alert>
        </div>
      )}
      <ul className="mt-2 divide-y divide-line">
        {visible.map((c) => (
          <li key={c.key} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
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

/**
 * Settings, in four tabs instead of one long scroll (owner feedback: it was
 * hard to tell what each control was for). A side menu on a wide screen,
 * swipeable pills on a phone; the open tab is kept in the address (?tab=)
 * so it survives a refresh and can be linked to.
 */
const Settings = () => {
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab') as Tab | null
  const tab: Tab = TABS.some((t) => t.id === requested) ? (requested as Tab) : 'look'
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = panelRef.current
    if (!el || prefersReducedMotion()) return
    const tween = gsap.fromTo(
      el,
      { autoAlpha: 0, y: 8 },
      { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out', clearProps: 'opacity,visibility,transform' },
    )
    return () => {
      tween.kill()
    }
  }, [tab])

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageHeader
        title="Settings"
        icon={IconSettings}
        description="How Fico looks, reads and speaks up — just for you."
      />

      <div className="grid items-start gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav
          aria-label="Settings sections"
          data-tour="settings-tabs"
          className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 lg:sticky lg:top-[calc(var(--header-h,6rem)+1rem)] lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0"
        >
          {TABS.map((t) => {
            const Icon = t.icon
            const active = t.id === tab
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setParams({ tab: t.id }, { replace: true })}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'flex shrink-0 items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors lg:py-2.5',
                  active ? 'border-brand/40 bg-brand/10 text-ink' : 'border-line bg-panel text-muted hover:text-ink',
                )}
              >
                <span
                  className={cx(
                    'flex h-8 w-8 items-center justify-center rounded-lg',
                    active ? 'bg-brand text-brand-ink' : 'bg-panel-2',
                  )}
                >
                  <Icon size={16} />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{t.label}</span>
                  <span className="hidden text-xs text-muted lg:block">{t.hint}</span>
                </span>
              </button>
            )
          })}
        </nav>

        <div ref={panelRef} key={tab} className="min-w-0">
          {tab === 'look' && <LookTab />}
          {tab === 'text' && <TextTab />}
          {tab === 'currency' && <CurrencyTab />}
          {tab === 'notifications' && <NotificationsTab />}
        </div>
      </div>
    </div>
  )
}

export default Settings
