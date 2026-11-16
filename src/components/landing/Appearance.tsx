import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import FicoLogo from '../FicoLogo'
import { FONTS, PALETTES } from '../../features/theme'
import { IconCheck, IconHome, IconMoon, IconReceipt, IconSun } from '../icons'

/**
 * Front page → "Make it yours": a showcase of how Fico can look. A small
 * Fico card you can recolour with a colour wheel (or the 16 suggested
 * colours), and a big "Font" that rolls through every bundled typeface.
 * Nothing here changes the visitor's saved settings — it's a preview.
 */

// ── colour helpers ─────────────────────────────────────────────────────
const hslToHex = (h: number, s: number, l: number) => {
  const a = (s * Math.min(l, 1 - l)) / 1
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(c * 255).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/** Dark or light text, whichever reads better on this colour. */
const inkFor = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#1a1626' : '#ffffff'
}

// ── the object: a little Fico card that wears the picked colour ────────
const PreviewCard = ({ color }: { color: string }) => (
  <div
    className="card w-full max-w-sm overflow-hidden p-0 sm:p-0"
    // The colour (and the logo's shades of it) apply to this card only.
    style={
      {
        '--brand': color,
        '--brand-ink': inkFor(color),
        '--logo-from': `color-mix(in srgb, ${color} 62%, #000)`,
        '--logo-to': color,
        '--logo-leaf-from': `color-mix(in srgb, ${color} 62%, #fff)`,
        '--logo-leaf-to': `color-mix(in srgb, ${color} 80%, #fff)`,
      } as CSSProperties
    }
  >
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
        <p className="text-3xl font-extrabold tabular-nums text-ink">₱61,513.00</p>
      </div>
      <div>
        <div className="flex justify-between text-xs">
          <span className="text-muted">Groceries budget</span>
          <span className="font-semibold text-ink">62%</span>
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

// ── the colour wheel ───────────────────────────────────────────────────
const ColorWheel = ({ hue, sat, onPick }: { hue: number; sat: number; onPick: (h: number, s: number) => void }) => {
  const ref = useRef<HTMLDivElement>(null)
  const pickAt = (e: PointerEvent<HTMLDivElement>) => {
    const r = ref.current!.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    const h = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360
    const s = Math.min(1, Math.hypot(dx, dy) / (r.width / 2))
    onPick(h, s)
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 15 : 5
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onPick((hue + step) % 360, sat)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onPick((hue - step + 360) % 360, sat)
    else return
    e.preventDefault()
  }
  // Where the marker sits: angle from the top, distance from the centre.
  const rad = (hue * Math.PI) / 180
  const x = 50 + Math.sin(rad) * sat * 50
  const y = 50 - Math.cos(rad) * sat * 50
  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Colour wheel"
      aria-valuemin={0}
      aria-valuemax={359}
      aria-valuenow={Math.round(hue)}
      aria-valuetext={`Hue ${Math.round(hue)} degrees`}
      onKeyDown={onKey}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        pickAt(e)
      }}
      onPointerMove={(e) => {
        if (e.buttons) pickAt(e)
      }}
      className="relative aspect-square w-52 shrink-0 cursor-crosshair touch-none rounded-full shadow-lg ring-1 ring-line sm:w-60"
      style={{
        background:
          'radial-gradient(circle closest-side, #fff 0%, rgb(255 255 255 / 0) 100%), conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-md"
        style={{ left: `${x}%`, top: `${y}%`, background: hslToHex(hue, 1, 1 - sat / 2) }}
      />
    </div>
  )
}

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
  const [hue, setHue] = useState(275)
  const [sat, setSat] = useState(0.85)
  const [color, setColor] = useState('#9333ea')

  const pick = (h: number, s: number) => {
    setHue(h)
    setSat(s)
    setColor(hslToHex(h, 1, 1 - s / 2))
  }
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
          <PreviewCard color={color} />
        </div>
        <div className="flex flex-col items-center gap-5 lg:items-start">
          <ColorWheel hue={hue} sat={sat} onPick={pick} />
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
                  aria-pressed={color.toLowerCase() === p.swatch.toLowerCase()}
                  onClick={() => setColor(p.swatch)}
                  className="h-7 w-7 rounded-full ring-1 ring-line transition-transform hover:scale-110 aria-pressed:ring-2 aria-pressed:ring-offset-2 aria-pressed:ring-offset-surface"
                  style={{ background: p.swatch }}
                />
              ))}
            </div>
          </div>
          <p className="max-w-xs text-center text-xs text-muted lg:text-left">
            Today Fico comes in {PALETTES.length} colours. Picking any colour you like, like on this wheel, is coming to
            Settings soon.
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
        <li className="card flex items-center gap-3 p-4">
          <span className="flex gap-1 text-brand">
            <IconSun size={18} />
            <IconMoon size={18} />
          </span>
          <span className="text-sm">
            <span className="block font-semibold text-ink">Light, dark or automatic</span>
            <span className="text-muted">Follows your device if you like</span>
          </span>
        </li>
        <li className="card flex items-center gap-3 p-4">
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
        <li className="card flex items-center gap-3 p-4">
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
