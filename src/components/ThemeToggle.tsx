import { useSyncExternalStore } from 'react'
import { effectiveTheme, subscribeTheme, toggleThemeAnimated } from '../features/theme'
import { IconMoon, IconSun } from './icons'

/**
 * Light/dark switch in the header. Follows the device until it's pressed;
 * Settings → Theme → System hands control back to the device.
 */
const ThemeToggle = () => {
  const theme = useSyncExternalStore(subscribeTheme, effectiveTheme, () => 'light' as const)
  const next = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      data-tour="theme-toggle"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        toggleThemeAnimated({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
      }}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-panel text-muted transition hover:bg-panel-2 hover:text-ink active:scale-95"
    >
      {theme === 'dark' ? <IconSun size={17} /> : <IconMoon size={17} />}
    </button>
  )
}

export default ThemeToggle
