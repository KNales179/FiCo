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
export type FontSize = 'sm' | 'md' | 'lg'
/** Bundled typefaces (src/fonts.css) — all work offline. */
export type FontFamily = 'jakarta' | 'inter' | 'manrope' | 'nunito' | 'system'
export type Density = 'comfortable' | 'compact'

export interface Appearance {
  theme: ThemeMode
  palette: Palette
  fontSize: FontSize
  font: FontFamily
  /** Row/list spacing — "compact" fits more on screen, e.g. a long Records table. */
  density: Density
  /** How many rows the Records list opens with — still changeable per-visit there. */
  defaultPageSize: number
}

export const DEFAULT_APPEARANCE: Appearance = {
  theme: 'system',
  palette: 'purple',
  fontSize: 'md',
  font: 'jakarta',
  density: 'comfortable',
  defaultPageSize: 25,
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

export const FONTS: { value: FontFamily; label: string; hint: string; stack: string }[] = [
  {
    value: 'jakarta',
    label: 'Jakarta',
    hint: 'Modern and friendly — the default',
    stack: "'Plus Jakarta Sans Variable', system-ui, sans-serif",
  },
  {
    value: 'inter',
    label: 'Inter',
    hint: 'Neutral and very readable',
    stack: "'Inter Variable', system-ui, sans-serif",
  },
  {
    value: 'manrope',
    label: 'Manrope',
    hint: 'Clean and geometric',
    stack: "'Manrope Variable', system-ui, sans-serif",
  },
  {
    value: 'nunito',
    label: 'Nunito',
    hint: 'Soft and rounded',
    stack: "'Nunito Variable', system-ui, sans-serif",
  },
  {
    value: 'system',
    label: 'System',
    hint: "Your device's own font",
    stack: "system-ui, 'Segoe UI', Roboto, sans-serif",
  },
]

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

  if (appearance.palette === 'purple') root.removeAttribute('data-palette')
  else root.setAttribute('data-palette', appearance.palette)

  if (appearance.fontSize === 'md') root.removeAttribute('data-font-size')
  else root.setAttribute('data-font-size', appearance.fontSize)

  if (appearance.font === 'jakarta') root.removeAttribute('data-font')
  else root.setAttribute('data-font', appearance.font)

  if (appearance.density === 'comfortable') root.removeAttribute('data-density')
  else root.setAttribute('data-density', appearance.density)
}

export const saveAppearance = (appearance: Appearance): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance))
  } catch {
    // Private browsing / storage disabled — the choice just won't persist.
  }
}

/** Load, apply, and return the current appearance — call once at startup. */
export const initAppearance = (): Appearance => {
  const appearance = loadAppearance()
  applyAppearance(appearance)
  return appearance
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
