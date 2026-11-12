import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { gsap, prefersReducedMotion } from '../../lib/motion'
import { formatMoney } from '../../domain/money'
import { CATEGORY_COLORS, OTHER_COLOR, compactMoney } from './palette'

/**
 * Fico's small chart kit — plain SVG + GSAP, no chart library (it stays
 * light for an offline-first app). Conventions, from the data-viz method:
 * thin marks, 4px rounded data ends sitting on the baseline, recessive
 * grid, one y-axis only, a hover tooltip on every mark, legend whenever
 * there are two or more series, and text always in ink colours (never the
 * series colour). Marks grow / draw in once, and never for reduced motion.
 */

/** A "nice" axis maximum and 3–4 evenly spaced ticks above zero. */
const niceTicks = (max: number) => {
  if (max <= 0) return { top: 1, ticks: [0] }
  const rough = max / 3
  const pow = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? rough
  const top = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v)
  return { top, ticks }
}

const useWidth = <T extends HTMLElement>() => {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const observer = new ResizeObserver(() => setWidth(el.clientWidth))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

export const Legend = ({ items }: { items: { label: string; color: string }[] }) => (
  <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
    {items.map((i) => (
      <li key={i.label} className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} aria-hidden="true" />
        {i.label}
      </li>
    ))}
  </ul>
)

const Tooltip = ({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) => (
  <div
    className="chart-tooltip"
    style={{
      left: Math.min(Math.max(x, 8), Math.max(8, width - 140)),
      top: Math.max(y - 8, 0),
      transform: 'translateY(-100%)',
    }}
  >
    {children}
  </div>
)

export const EmptyChart = ({ children }: { children: ReactNode }) => (
  <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-line text-xs text-muted">
    {children}
  </div>
)

// ---------------------------------------------------------------------------
// Vertical bars — one series, or two side by side (e.g. in vs out per month)
// ---------------------------------------------------------------------------

export interface BarDatum {
  key: string
  label: string
  /** Longer label for the tooltip (defaults to `label`). */
  title?: string
  values: number[]
}

export const BarChart = ({
  data,
  series,
  currency = 'PHP',
  height = 180,
  ariaLabel,
}: {
  data: BarDatum[]
  series: { name: string; color: string }[]
  currency?: string
  height?: number
  ariaLabel: string
}) => {
  const [wrapRef, width] = useWidth<HTMLDivElement>()
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  // Animate when the numbers change — not every time a parent re-renders
  // with a fresh (but identical) array.
  const signature = JSON.stringify(data.map((d) => [d.key, d.values]))

  const padL = 44
  const padB = 22
  const padT = 8
  const plotW = Math.max(0, width - padL - 4)
  const plotH = height - padB - padT
  const max = Math.max(0, ...data.flatMap((d) => d.values))
  const { top, ticks } = niceTicks(max)
  const band = data.length ? plotW / data.length : 0
  const groupW = Math.min(band * 0.72, series.length > 1 ? 34 : 26)
  const barW = Math.max(2, (groupW - 2 * (series.length - 1)) / series.length)
  const y = (v: number) => padT + plotH - (v / top) * plotH
  // Thin the x labels so they never collide.
  const every = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(plotW / 46))))

  useEffect(() => {
    const svg = svgRef.current
    if (!svg || !width || prefersReducedMotion()) return
    const bars = svg.querySelectorAll('[data-bar]')
    const tween = gsap.from(bars, {
      scaleY: 0,
      transformOrigin: '50% 100%',
      duration: 0.7,
      ease: 'power3.out',
      stagger: { amount: 0.35 },
    })
    return () => {
      tween.revert()
    }
    // Animate once per data set, not on every resize.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, width > 0])

  const roundedTop = (x: number, yTop: number, w: number, h: number) => {
    const r = Math.min(4, w / 2, h)
    const yb = yTop + h
    return `M${x},${yb} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + w - r} Q${x + w},${yTop} ${x + w},${yTop + r} V${yb} Z`
  }

  return (
    <div ref={wrapRef} className="relative w-full" onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg ref={svgRef} width={width} height={height} role="img" aria-label={ariaLabel} className="block">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={width - 4} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeDasharray={t === 0 ? undefined : '3 4'} />
              <text x={padL - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize="10" fill="var(--muted)">
                {compactMoney(t, currency)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const gx = padL + band * i + (band - groupW) / 2
            return (
              <g key={d.key} opacity={hover === null || hover === i ? 1 : 0.45}>
                {d.values.map((v, s) => {
                  const h = Math.max(v > 0 ? 2 : 0, (v / top) * plotH)
                  return (
                    <path
                      key={s}
                      data-bar=""
                      d={roundedTop(gx + s * (barW + 2), padT + plotH - h, barW, h)}
                      fill={series[s].color}
                    />
                  )
                })}
                {i % every === 0 && (
                  <text x={padL + band * i + band / 2} y={height - 6} textAnchor="middle" fontSize="10" fill="var(--muted)">
                    {d.label}
                  </text>
                )}
                {/* Hit target wider than the bars themselves. */}
                <rect
                  x={padL + band * i}
                  y={padT}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onTouchStart={() => setHover(i)}
                />
              </g>
            )
          })}
        </svg>
      )}
      {hover !== null && data[hover] && (
        <Tooltip x={padL + band * hover + band / 2 - 60} y={y(Math.max(...data[hover].values))} width={width}>
          <div className="font-semibold">{data[hover].title ?? data[hover].label}</div>
          {data[hover].values.map((v, s) => (
            <div key={s} className="mt-0.5 flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-muted">
                <span className="h-2 w-2 rounded-sm" style={{ background: series[s].color }} />
                {series[s].name}
              </span>
              <span className="font-medium tabular-nums">{formatMoney(v, currency)}</span>
            </div>
          ))}
        </Tooltip>
      )}
      {series.length > 1 && (
        <div className="mt-2">
          <Legend items={series.map((s) => ({ label: s.name, color: s.color }))} />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Horizontal ranked bars — "where it went", largest first
// ---------------------------------------------------------------------------

export const RankedBars = ({
  rows,
  currency = 'PHP',
  color = 'var(--brand)',
  max: maxRows = 6,
}: {
  rows: { label: string; value: number; note?: string }[]
  currency?: string
  color?: string
  max?: number
}) => {
  const ref = useRef<HTMLUListElement>(null)
  const shown = rows.slice(0, maxRows)
  const top = Math.max(1, ...shown.map((r) => r.value))
  const signature = JSON.stringify(shown.map((r) => [r.label, r.value]))

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    const tween = gsap.from(el.querySelectorAll('[data-fill]'), {
      scaleX: 0,
      transformOrigin: '0% 50%',
      duration: 0.7,
      ease: 'power3.out',
      stagger: 0.06,
    })
    return () => {
      tween.revert()
    }
  }, [signature])

  return (
    <ul ref={ref} className="space-y-2.5">
      {shown.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-ink">{r.label}</span>
            <span className="shrink-0 tabular-nums text-muted">
              {formatMoney(r.value, currency)}
              {r.note && <span className="ml-1 text-xs">{r.note}</span>}
            </span>
          </div>
          <div className="mt-1 h-2 w-full rounded-full bg-panel-2">
            <div
              data-fill=""
              className="h-2 rounded-full"
              style={{ width: `${(r.value / top) * 100}%`, background: color }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// Donut — part-to-whole, at most six slices + "Other", always with a legend
// that carries labels and amounts (so no slice relies on colour alone)
// ---------------------------------------------------------------------------

export const DonutChart = ({
  slices,
  currency = 'PHP',
  centerLabel,
  centerValue,
  size = 168,
}: {
  slices: { label: string; value: number; color?: string }[]
  currency?: string
  centerLabel: string
  centerValue: string
  size?: number
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)

  const prepared = useMemo(() => {
    const positive = slices.filter((s) => s.value > 0).sort((a, b) => b.value - a.value)
    const head = positive.slice(0, 6).map((s, i) => ({ ...s, color: s.color ?? CATEGORY_COLORS[i] }))
    const rest = positive.slice(6).reduce((sum, s) => sum + s.value, 0)
    return rest > 0 ? [...head, { label: 'Other', value: rest, color: OTHER_COLOR }] : head
  }, [slices])
  const total = prepared.reduce((sum, s) => sum + s.value, 0)
  const signature = JSON.stringify(prepared.map((s) => [s.label, s.value]))

  const stroke = 22
  const r = size / 2 - stroke / 2 - 2
  const c = 2 * Math.PI * r
  const gap = prepared.length > 1 ? 2 : 0

  useEffect(() => {
    const svg = svgRef.current
    if (!svg || prefersReducedMotion()) return
    const tween = gsap.from(svg.querySelectorAll('[data-slice]'), {
      strokeDasharray: `0 ${c}`,
      duration: 0.9,
      ease: 'power2.out',
      stagger: 0.08,
    })
    return () => {
      tween.revert()
    }
     
  }, [signature, c])

  let offset = 0
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg ref={svgRef} width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${centerLabel}: ${centerValue}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--panel-2)" strokeWidth={stroke} />
          {total > 0 &&
            prepared.map((s, i) => {
              const len = (s.value / total) * c
              const dash = Math.max(0, len - gap)
              const el = (
                <circle
                  key={s.label}
                  data-slice=""
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={hover === i ? stroke + 4 : stroke}
                  strokeDasharray={`${dash} ${c - dash}`}
                  strokeDashoffset={-offset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  opacity={hover === null || hover === i ? 1 : 0.4}
                  style={{ transition: 'opacity .2s, stroke-width .2s' }}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
              )
              offset += len
              return el
            })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] text-muted">{hover !== null ? prepared[hover].label : centerLabel}</span>
          <span className="text-base font-bold tabular-nums text-ink">
            {hover !== null ? formatMoney(prepared[hover].value, currency) : centerValue}
          </span>
        </div>
      </div>
      <ul className="min-w-[10rem] flex-1 space-y-1.5 text-sm">
        {prepared.map((s, i) => (
          <li
            key={s.label}
            className="flex items-center justify-between gap-3"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
              <span className="truncate text-ink">{s.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted">
              {formatMoney(s.value, currency)}
              <span className="ml-1.5 text-xs">{total ? Math.round((s.value / total) * 100) : 0}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Area line — one series over time, crosshair tooltip
// ---------------------------------------------------------------------------

export const AreaChart = ({
  points,
  currency = 'PHP',
  height = 160,
  color = 'var(--brand)',
  ariaLabel,
}: {
  points: { key: string; label: string; title?: string; value: number }[]
  currency?: string
  height?: number
  color?: string
  ariaLabel: string
}) => {
  const [wrapRef, width] = useWidth<HTMLDivElement>()
  const lineRef = useRef<SVGPathElement>(null)
  const areaRef = useRef<SVGPathElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const signature = JSON.stringify(points.map((p) => [p.key, p.value]))

  const padL = 44
  const padB = 22
  const padT = 10
  const plotW = Math.max(0, width - padL - 6)
  const plotH = height - padB - padT
  const { top, ticks } = niceTicks(Math.max(0, ...points.map((p) => p.value)))
  const x = (i: number) => padL + (points.length > 1 ? (i / (points.length - 1)) * plotW : plotW / 2)
  const y = (v: number) => padT + plotH - (v / top) * plotH
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ')
  const area = points.length ? `${line} L${x(points.length - 1)},${padT + plotH} L${x(0)},${padT + plotH} Z` : ''
  const every = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(plotW / 56))))
  const gradId = `area-${useId().replace(/:/g, '')}`

  useEffect(() => {
    const path = lineRef.current
    if (!path || !width || prefersReducedMotion()) return
    const length = path.getTotalLength()
    const tl = gsap.timeline()
    tl.fromTo(path, { strokeDasharray: length, strokeDashoffset: length }, { strokeDashoffset: 0, duration: 1, ease: 'power2.out', clearProps: 'strokeDasharray,strokeDashoffset' })
    if (areaRef.current) tl.from(areaRef.current, { opacity: 0, duration: 0.6 }, 0.4)
    return () => {
      tl.revert()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, width > 0])

  const onMove = (clientX: number, rect: DOMRect) => {
    if (points.length === 0) return
    const rel = clientX - rect.left - padL
    const i = Math.round((rel / Math.max(1, plotW)) * (points.length - 1))
    setHover(Math.min(points.length - 1, Math.max(0, i)))
  }

  return (
    <div ref={wrapRef} className="relative w-full" onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          className="block"
          onMouseMove={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
          onTouchMove={(e) => onMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}
        >
          <defs>
            <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={width - 6} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeDasharray={t === 0 ? undefined : '3 4'} />
              <text x={padL - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize="10" fill="var(--muted)">
                {compactMoney(t, currency)}
              </text>
            </g>
          ))}
          <path ref={areaRef} d={area} fill={`url(#${gradId})`} />
          <path ref={lineRef} d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) =>
            i % every === 0 ? (
              <text key={p.key} x={x(i)} y={height - 6} textAnchor="middle" fontSize="10" fill="var(--muted)">
                {p.label}
              </text>
            ) : null,
          )}
          {hover !== null && points[hover] && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + plotH} stroke="var(--muted)" strokeDasharray="3 3" />
              <circle cx={x(hover)} cy={y(points[hover].value)} r="5" fill={color} stroke="var(--panel)" strokeWidth="2" />
            </g>
          )}
        </svg>
      )}
      {hover !== null && points[hover] && (
        <Tooltip x={x(hover) - 60} y={y(points[hover].value)} width={width}>
          <div className="text-muted">{points[hover].title ?? points[hover].label}</div>
          <div className="font-semibold tabular-nums">{formatMoney(points[hover].value, currency)}</div>
        </Tooltip>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Count-up number for stat tiles
// ---------------------------------------------------------------------------

export const CountUp = ({ value, format }: { value: number; format: (n: number) => string }) => {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion()) {
      el.textContent = format(value)
      return
    }
    const state = { n: 0 }
    const tween = gsap.to(state, {
      n: value,
      duration: 1.1,
      ease: 'power3.out',
      onUpdate: () => {
        el.textContent = format(Math.round(state.n))
      },
    })
    return () => {
      tween.kill()
    }
  }, [value, format])
  return <span ref={ref}>{format(value)}</span>
}
