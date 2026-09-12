/**
 * Appearance preferences (Settings page): theme mode, accent palette, and
 * font size. Deliberately local-only (localStorage, not synced) — this is
 * a per-device reading preference, not Finance data. The very first paint
 * is handled by a tiny inline script in index.html reading the same key,
 * so there's no flash of the default before this module even loads;
 * everything here is for applying a *change* live and persisting it.
 */

export type ThemeMode = 'system' | 'light' | 'dark'
export type Palette = 'purple' | 'blue' | 'teal' | 'rose' | 'slate'
export type FontSize = 'sm' | 'md' | 'lg'
export type Density = 'comfortable' | 'compact'

export interface Appearance {
  theme: ThemeMode
  palette: Palette
  fontSize: FontSize
  /** Row/list spacing — "compact" fits more on screen, e.g. a long Records table. */
  density: Density
  /** How many rows the Records list opens with — still changeable per-visit there. */
  defaultPageSize: number
}

export const DEFAULT_APPEARANCE: Appearance = {
  theme: 'system',
  palette: 'purple',
  fontSize: 'md',
  density: 'comfortable',
  defaultPageSize: 25,
}

export const PALETTES: { value: Palette; label: string; swatch: string }[] = [
  { value: 'purple', label: 'Purple', swatch: '#7c3aed' },
  { value: 'blue', label: 'Blue', swatch: '#2563eb' },
  { value: 'teal', label: 'Teal', swatch: '#0d9488' },
  { value: 'rose', label: 'Rose', swatch: '#e11d48' },
  { value: 'slate', label: 'Slate', swatch: '#475569' },
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
