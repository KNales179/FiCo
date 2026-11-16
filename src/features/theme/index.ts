import { HEX_RE, applyCustomPalette } from './color'
/**
 * Appearance preferences (Settings page): theme mode, accent palette, and
 * font size. Deliberately local-only (localStorage, not synced) — this is
 * a per-device reading preference, not Finance data. The very first paint
 * is handled by a tiny inline script in index.html reading the same key,
 * so there's no flash of the default before this module even loads;
 * everything here is for applying a *change* live and persisting it.
 */

export type ThemeMode = 'system' | 'light' | 'dark'
export type Palette =
  | 'purple'
  | 'blue'
  | 'teal'
  | 'rose'
  | 'slate'
  | 'white'
  | 'indigo'
  | 'green'
  | 'gold'
  | 'sky'
  | 'pink'
  | 'orange'
  | 'lime'
  | 'crimson'
  | 'brown'
  /** Any colour, from the colour wheel (Appearance.customColor). */
  | 'custom'
export type FontSize = 'sm' | 'md' | 'lg'
/** Bundled typefaces (src/fonts.css) — all work offline. */
export type FontFamily =
  | 'jakarta'
  | 'manrope'
  | 'outfit'
  | 'lexend'
  | 'inter'
  | 'plex'
  | 'source'
  | 'dmsans'
  | 'nunito'
  | 'quicksand'
  | 'fredoka'
  | 'baloo'
  | 'comic'
  | 'patrick'
  | 'system'
export type FontGroup = 'Modern' | 'Professional' | 'Cute' | 'Silly' | 'System'
export type Density = 'comfortable' | 'compact'

export interface Appearance {
  theme: ThemeMode
  palette: Palette
  fontSize: FontSize
  font: FontFamily
  /**
   * A personal "show me this too" currency (e.g. AED for someone abroad).
   * Purely a view on this device: amounts in the Finance's own currency get
   * an approximate converted line next to them. Never changes any record or
   * what anyone else in the Finance sees. null = off.
   */
  displayCurrency: string | null
  /** Row/list spacing — "compact" fits more on screen, e.g. a long Records table. */
  density: Density
  /** How many rows the Records list opens with — still changeable per-visit there. */
  defaultPageSize: number
  /** The colour for palette "custom" ("#rrggbb"), picked on a colour wheel. */
  customColor?: string | null
}

export const DEFAULT_APPEARANCE: Appearance = {
  theme: 'system',
  palette: 'purple',
  fontSize: 'md',
  font: 'jakarta',
  displayCurrency: null,
  density: 'comfortable',
  defaultPageSize: 25,
  customColor: null,
}

export const PALETTES: { value: Palette; label: string; swatch: string }[] = [
  { value: 'purple', label: 'Purple', swatch: '#9333ea' },
  { value: 'blue', label: 'Blue', swatch: '#2563eb' },
  { value: 'teal', label: 'Teal', swatch: '#0d9488' },
  { value: 'rose', label: 'Rose', swatch: '#e11d48' },
  { value: 'slate', label: 'Slate', swatch: '#475569' },
  { value: 'white', label: 'White', swatch: '#ffffff' },
  { value: 'indigo', label: 'Indigo', swatch: '#4f46e5' },
  { value: 'green', label: 'Green', swatch: '#15803d' },
  { value: 'gold', label: 'Gold', swatch: '#a16207' },
  { value: 'sky', label: 'Sky', swatch: '#0369a1' },
  { value: 'pink', label: 'Pink', swatch: '#be185d' },
  { value: 'orange', label: 'Orange', swatch: '#c2410c' },
  { value: 'lime', label: 'Lime', swatch: '#4d7c0f' },
  { value: 'crimson', label: 'Crimson', swatch: '#b91c1c' },
  { value: 'brown', label: 'Brown', swatch: '#78350f' },
]

export const FONTS: {
  value: FontFamily
  label: string
  group: FontGroup
  hint: string
  stack: string
}[] = [
  { value: 'jakarta', label: 'Plus Jakarta Sans', group: 'Modern', hint: 'The default — modern and friendly', stack: "'Plus Jakarta Sans Variable', system-ui, sans-serif" },
  { value: 'manrope', label: 'Manrope', group: 'Modern', hint: 'Clean and geometric', stack: "'Manrope Variable', system-ui, sans-serif" },
  { value: 'outfit', label: 'Outfit', group: 'Modern', hint: 'Round and airy', stack: "'Outfit Variable', system-ui, sans-serif" },
  { value: 'lexend', label: 'Lexend', group: 'Modern', hint: 'Extra easy to read', stack: "'Lexend Variable', system-ui, sans-serif" },
  { value: 'inter', label: 'Inter', group: 'Professional', hint: 'Neutral and very readable', stack: "'Inter Variable', system-ui, sans-serif" },
  { value: 'plex', label: 'IBM Plex Sans', group: 'Professional', hint: 'Crisp and businesslike', stack: "'IBM Plex Sans Variable', system-ui, sans-serif" },
  { value: 'source', label: 'Source Sans', group: 'Professional', hint: 'Classic and tidy', stack: "'Source Sans 3 Variable', system-ui, sans-serif" },
  { value: 'dmsans', label: 'DM Sans', group: 'Professional', hint: 'Simple and sharp', stack: "'DM Sans Variable', system-ui, sans-serif" },
  { value: 'nunito', label: 'Nunito', group: 'Cute', hint: 'Soft and rounded', stack: "'Nunito Variable', system-ui, sans-serif" },
  { value: 'quicksand', label: 'Quicksand', group: 'Cute', hint: 'Light and bubbly', stack: "'Quicksand Variable', system-ui, sans-serif" },
  { value: 'fredoka', label: 'Fredoka', group: 'Cute', hint: 'Chunky and playful', stack: "'Fredoka Variable', system-ui, sans-serif" },
  { value: 'baloo', label: 'Baloo', group: 'Cute', hint: 'Bouncy and warm', stack: "'Baloo 2 Variable', system-ui, sans-serif" },
  { value: 'comic', label: 'Comic Neue', group: 'Silly', hint: 'Comic Sans, but tidier', stack: "'Comic Neue', 'Comic Sans MS', system-ui, sans-serif" },
  { value: 'patrick', label: 'Patrick Hand', group: 'Silly', hint: 'Looks handwritten', stack: "'Patrick Hand', system-ui, sans-serif" },
  { value: 'system', label: 'Device font', group: 'System', hint: "Your phone or computer's own font", stack: "system-ui, 'Segoe UI', Roboto, sans-serif" },
]

export const fontStack = (font: FontFamily): string =>
  (FONTS.find((f) => f.value === font) ?? FONTS[0]).stack

const STORAGE_KEY = 'fico.appearance'

export const loadAppearance = (): Appearance => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_APPEARANCE
    return { ...DEFAULT_APPEARANCE, ...(JSON.parse(raw) as Partial<Appearance>) }
  } catch {
    return DEFAULT_APPEARANCE
  }
}

/** Stamps (or clears) the `<html>` attributes the CSS in index.css keys off of. */
export const applyAppearance = (appearance: Appearance): void => {
  const root = document.documentElement

  if (appearance.theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', appearance.theme)

  // A custom colour without a valid colour falls back to the default purple.
  const custom = appearance.palette === 'custom' && HEX_RE.test(appearance.customColor ?? '')
  applyCustomPalette(custom ? appearance.customColor! : null)
  if (appearance.palette === 'purple' || (appearance.palette === 'custom' && !custom)) root.removeAttribute('data-palette')
  else root.setAttribute('data-palette', appearance.palette)

  if (appearance.fontSize === 'md') root.removeAttribute('data-font-size')
  else root.setAttribute('data-font-size', appearance.fontSize)

  // The font is set straight onto --font-ui, so adding a font only means
  // adding it to FONTS (and src/fonts.css) — no per-font CSS rule needed.
  if (appearance.font === 'jakarta') root.style.removeProperty('--font-ui')
  else root.style.setProperty('--font-ui', fontStack(appearance.font))

  if (appearance.density === 'comfortable') root.removeAttribute('data-density')
  else root.setAttribute('data-density', appearance.density)
}

export const APPEARANCE_EVENT = 'fico:appearance'

export const saveAppearance = (appearance: Appearance): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance))
  } catch {
    // Private browsing / storage disabled — the choice just won't persist.
  }
  // Let anything showing appearance-driven content (the display currency)
  // update right away, not just on the next page load.
  window.dispatchEvent(new Event(APPEARANCE_EVENT))
}

/** Load, apply, and return the current appearance — call once at startup. */
export const initAppearance = (): Appearance => {
  const appearance = loadAppearance()
  applyAppearance(appearance)
  return appearance
}

/** For useSyncExternalStore: fires when the saved theme (an <html> attribute) or the OS theme changes. */
export const subscribeTheme = (onChange: () => void) => {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', onChange)
  return () => {
    observer.disconnect()
    media.removeEventListener('change', onChange)
  }
}

/** The theme actually on screen right now — "system" resolved against the OS. */
export const effectiveTheme = (): 'light' | 'dark' => {
  const attr = document.documentElement.getAttribute('data-theme')
  if (attr === 'light' || attr === 'dark') return attr
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * The navbar's light/dark switch. Flips to the opposite of what's showing
 * and saves it (Settings → Theme → System goes back to following the
 * device). Where the browser supports view transitions, the new theme is
 * revealed as a circle growing out of the button that was pressed.
 */
export const toggleThemeAnimated = (origin?: { x: number; y: number }): Appearance => {
  const next: Appearance = {
    ...loadAppearance(),
    theme: effectiveTheme() === 'dark' ? 'light' : 'dark',
  }
  saveAppearance(next)

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { ready: Promise<void> }
  }
  if (!doc.startViewTransition || reduce) {
    applyAppearance(next)
    return next
  }

  const x = origin?.x ?? window.innerWidth / 2
  const y = origin?.y ?? 0
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
  const transition = doc.startViewTransition(() => applyAppearance(next))
  void transition.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 650, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' },
    )
  })
  return next
}
