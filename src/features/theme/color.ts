/**
 * Custom accent colours (Settings → Colour → Custom, and the front page's
 * colour wheel). A built-in palette is just --brand + --brand-ink, with a
 * lighter version for dark mode; a custom colour gets the same, worked
 * out here so text on it always stays readable.
 */

export const HEX_RE = /^#[0-9a-f]{6}$/i

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Hue 0–360, saturation and lightness 0–1. */
export const hslToHex = (h: number, s: number, l: number): string => {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(c * 255).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/** On the colour wheel: hue around it, saturation from the centre (white) to the edge. */
export const wheelColor = (hue: number, sat: number): string => hslToHex(hue, 1, 1 - sat / 2)

/** Where a colour sits on the wheel (the reverse of wheelColor, near enough). */
export const wheelPosition = (hex: string): { hue: number; sat: number } => {
  const [r, g, b] = rgb(hex).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let hue = 0
  if (d) {
    if (max === r) hue = 60 * (((g - b) / d) % 6)
    else if (max === g) hue = 60 * ((b - r) / d + 2)
    else hue = 60 * ((r - g) / d + 4)
  }
  return { hue: (hue + 360) % 360, sat: Math.min(1, d) }
}


/** Relative luminance, 0 (black) to 1 (white). */
export const luminance = (hex: string): number => {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** `amount` of the way from `hex` towards `to`. */
export const mix = (hex: string, to: string, amount: number): string => {
  const a = rgb(hex)
  const b = rgb(to)
  return `#${a
    .map((v, i) => Math.round(v + (b[i] - v) * amount).toString(16).padStart(2, '0'))
    .join('')}`
}

/** Dark or light text, whichever reads better on this colour. */
export const inkFor = (hex: string): string => (luminance(hex) > 0.45 ? '#1a1626' : '#ffffff')

/** The accent and its text colour for light and dark mode. */
export const customTokens = (hex: string) => {
  // Very light colours get a touch deeper on light backgrounds, very dark
  // ones a touch lighter on dark backgrounds, so they still show up.
  const light = luminance(hex) > 0.6 ? mix(hex, '#000000', 0.25) : hex
  const dark = luminance(hex) < 0.18 ? mix(hex, '#ffffff', 0.35) : hex
  return { light: { brand: light, ink: inkFor(light) }, dark: { brand: dark, ink: inkFor(dark) } }
}

const STYLE_ID = 'fico-custom-palette'

/** The CSS for data-palette="custom" — the same three cases as index.css. */
export const customPaletteCss = (hex: string): string => {
  const { light, dark } = customTokens(hex)
  const l = `--brand: ${light.brand}; --brand-ink: ${light.ink};`
  const d = `--brand: ${dark.brand}; --brand-ink: ${dark.ink};`
  return (
    `:root[data-palette="custom"] { ${l} }\n` +
    `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"])[data-palette="custom"] { ${d} } }\n` +
    `:root[data-theme="dark"][data-palette="custom"] { ${d} }`
  )
}

/** Writes (or removes) the custom colour's CSS. */
export const applyCustomPalette = (hex: string | null): void => {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!hex || !HEX_RE.test(hex)) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('style')
    el.id = STYLE_ID
    document.head.appendChild(el)
  }
  el.textContent = customPaletteCss(hex)
}
