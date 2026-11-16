import { useEffect, useRef, useState } from 'react'
import RollingNumber from '../RollingNumber'
import FicoLogo from '../FicoLogo'
import ColorWheel from '../ColorWheel'
import { FONTS, PALETTES, applyAppearance, loadAppearance, saveAppearance, type Appearance as Look } from '../../features/theme'
import { wheelColor, wheelPosition } from '../../features/theme/color'
import { IconCheck, IconHome, IconMoon, IconReceipt, IconSun } from '../icons'

/**
 * Front page → "Make it yours": a showcase of how Fico can look. A small
 * Fico card you can recolour with a colour wheel (or the 16 suggested
 * colours), and a big "Font" that rolls through every bundled typeface.
 * The colour picked here recolours the whole page and is kept on this
 * device, so Fico opens in it after signing up (Settings → Colour).
 */

// ── the object: a little Fico card that wears the picked colour ────────
const PreviewCard = () => (
  <div className="card hover-card w-full max-w-sm overflow-hidden p-0 sm:p-0">
    <div className="flex items-center justify-between border-b border-line px-4 py-3">
      <span className="flex items-center gap-2">
        <FicoLogo className="h-7 w-7" />
        <span className="font-extrabold text-ink">Fico</span>
      </span>
      <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-xs font-semibold text-brand">Family</span>
    </div>
    <div className="space-y-4 p-4">
      <div>
        <p className="text-xs text-muted">Total balance</p>
        <p className="text-3xl font-extrabold tabular-nums text-ink"><RollingNumber spinOnHover value="₱61,513.00" /></p>
      </div>
      <div>
        <div className="flex justify-between text-xs">
          <span className="text-muted">Groceries budget</span>
          <span className="font-semibold text-ink"><RollingNumber spinOnHover value="62%" /></span>
        </div>
        <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-panel-2">
          <span className="block h-full w-[62%] rounded-full bg-brand" />
        </span>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-line px-3 py-2 text-sm">
        <span className="text-ink">Electric bill</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-xs font-semibold text-brand">
          <IconCheck size={12} /> Paid
        </span>
      </div>
      <div className="flex gap-2">
        <span className="flex-1 rounded-lg border border-line px-3 py-2 text-sm text-muted">₱150 · Lunch</span>
        <span className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-ink">Add</span>
      </div>
    </div>
    <div className="flex border-t border-line text-[11px]">
      {[
        { label: 'Home', icon: IconHome, active: true },
        { label: 'Bills', icon: IconReceipt, active: false },
      ].map(({ label, icon: Icon, active }) => (
        <span key={label} className={`flex flex-1 flex-col items-center gap-0.5 py-2 ${active ? 'text-brand' : 'text-muted'}`}>
          <Icon size={16} />
          {label}
        </span>
      ))}
    </div>
  </div>
)

// ── the rolling "Font" ─────────────────────────────────────────────────
const ROLL_MS = 1000
const STEP_MS = 65

const FontRoll = () => {
  const [index, setIndex] = useState(0)
  const rolling = useRef<number | null>(null)
  const font = FONTS[index]

  // Load every font as soon as this comes into view, so the roll never
  // flashes a fallback.
  const wrap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = wrap.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      io.disconnect()
      for (const f of FONTS) void document.fonts?.load(`800 64px ${f.stack}`).catch(() => undefined)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => () => {
    if (rolling.current) window.clearInterval(rolling.current)
  }, [])

  const roll = () => {
    if (rolling.current) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIndex((i) => (i + 1) % FONTS.length)
      return
    }
    const started = Date.now()
    rolling.current = window.setInterval(() => {
      setIndex((i) => (i + 1) % FONTS.length)
      if (Date.now() - started >= ROLL_MS && rolling.current) {
        window.clearInterval(rolling.current)
        rolling.current = null
      }
    }, STEP_MS)
  }

  return (
    <div ref={wrap} className="flex flex-col items-center text-center">
      <button
        type="button"
        onMouseEnter={roll}
        onFocus={roll}
        onClick={roll}
        aria-label={`Font: ${font.label}. Hover or tap to roll through Fico's fonts.`}
        className="select-none text-[6.5rem] font-extrabold leading-none tracking-tight text-ink transition-colors hover:text-brand sm:text-[9rem]"
        style={{ fontFamily: font.stack }}
      >
        Font
      </button>
      <p className="mt-4 text-sm text-muted" aria-live="polite">
        <span className="font-semibold text-ink">{font.label}</span> · {font.group} · {font.hint}
      </p>
      <p className="mt-3 text-lg text-ink" style={{ fontFamily: font.stack }}>
        Every peso, in its place. ₱1,234.50
      </p>
    </div>
  )
}

// ── the section ────────────────────────────────────────────────────────
const Appearance = () => {
  // What's picked is the page's real look: applied at once, and saved.
  const [look, setLook] = useState<Look>(loadAppearance)
  const set = (patch: Partial<Look>) => {
    const next = { ...loadAppearance(), ...patch }
    applyAppearance(next)
    saveAppearance(next)
    setLook(next)
  }
  const swatch = PALETTES.find((p) => p.value === look.palette)?.swatch
  const color = look.palette === 'custom' && look.customColor ? look.customColor : (swatch ?? '#9333ea')
  const pos = wheelPosition(color)
  const groups = [...new Set(FONTS.map((f) => f.group))]

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand">Appearance</p>
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Make it yours</h2>
        <p className="mt-3 text-muted">
          Your money, your look: pick a colour, a font, light or dark, and the text size that’s comfortable for you.
        </p>
      </div>

      {/* Colour */}
      <div className="mt-12 grid items-center gap-10 lg:grid-cols-2">
        <div className="flex justify-center lg:justify-end">
          <PreviewCard />
        </div>
        <div className="flex flex-col items-center gap-5 lg:items-start">
          <ColorWheel hue={pos.hue} sat={pos.sat} onPick={(h, sat) => set({ palette: 'custom', customColor: wheelColor(h, sat) })} />
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="h-4 w-4 rounded-full ring-1 ring-line" style={{ background: color }} />
            <span className="font-mono uppercase text-ink">{color}</span>
          </div>
          <div>
            <p className="text-center text-xs font-semibold uppercase tracking-wider text-muted lg:text-left">Or a suggested colour</p>
            <div className="mt-2 flex max-w-xs flex-wrap justify-center gap-2 lg:justify-start">
              {PALETTES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  title={p.label}
                  aria-label={`${p.label} colour`}
                  aria-pressed={look.palette === p.value}
                  onClick={() => set({ palette: p.value })}
                  className="h-7 w-7 rounded-full ring-1 ring-line transition-transform hover:scale-110 aria-pressed:ring-2 aria-pressed:ring-offset-2 aria-pressed:ring-offset-surface"
                  style={{ background: p.swatch }}
                />
              ))}
            </div>
          </div>
          <p className="max-w-xs text-center text-xs text-muted lg:text-left">
            {PALETTES.length} ready-made colours, or any colour on the wheel. Your pick is kept on this device, so Fico opens
            in it, and you can change it any time in Settings → Colour.{' '}
            {look.palette !== 'purple' && (
              <button type="button" onClick={() => set({ palette: 'purple' })} className="font-medium text-brand underline">
                Back to purple
              </button>
            )}
          </p>
        </div>
      </div>

      {/* Font */}
      <div className="mt-20">
        <FontRoll />
        <p className="mt-6 text-center text-sm text-muted">
          {FONTS.length} fonts: {groups.join(' · ')}
        </p>
      </div>

      {/* And the rest */}
      <ul className="mx-auto mt-14 grid max-w-4xl gap-3 sm:grid-cols-3">
        <li className="card hover-card flex items-center gap-3 p-4">
          <span className="flex gap-1 text-brand">
            <IconSun size={18} />
            <IconMoon size={18} />
          </span>
          <span className="text-sm">
            <span className="block font-semibold text-ink">Light, dark or automatic</span>
            <span className="text-muted">Follows your device if you like</span>
          </span>
        </li>
        <li className="card hover-card flex items-center gap-3 p-4">
          <span className="flex items-end gap-0.5 font-bold text-brand" aria-hidden="true">
            <span className="text-xs">A</span>
            <span className="text-sm">A</span>
            <span className="text-lg leading-none">A</span>
          </span>
          <span className="text-sm">
            <span className="block font-semibold text-ink">3 text sizes</span>
            <span className="text-muted">Small, regular or large</span>
          </span>
        </li>
        <li className="card hover-card flex items-center gap-3 p-4">
          <span className="flex flex-col gap-0.5" aria-hidden="true">
            <span className="h-1 w-5 rounded bg-brand" />
            <span className="h-1 w-5 rounded bg-brand/60" />
            <span className="h-1 w-5 rounded bg-brand/30" />
          </span>
          <span className="text-sm">
            <span className="block font-semibold text-ink">Roomy or compact</span>
            <span className="text-muted">Fit more on the screen</span>
          </span>
        </li>
      </ul>
    </section>
  )
}

export default Appearance
