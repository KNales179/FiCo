import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { wheelColor } from '../features/theme/color'

/**
 * A colour wheel: click or drag anywhere on it (arrow keys turn the hue).
 * Picks are reported at most once per frame, so dragging stays smooth
 * even when each pick restyles the whole page.
 */
const ColorWheel = ({
  hue,
  sat,
  onPick,
  className = 'w-52 sm:w-60',
}: {
  hue: number
  sat: number
  onPick: (hue: number, sat: number) => void
  className?: string
}) => {
  const ref = useRef<HTMLDivElement>(null)
  const frame = useRef(0)
  const pending = useRef<[number, number] | null>(null)

  const report = (h: number, s: number) => {
    pending.current = [h, s]
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      if (pending.current) onPick(...pending.current)
    })
  }
  const pickAt = (e: PointerEvent<HTMLDivElement>) => {
    const r = ref.current!.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    report(((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360, Math.min(1, Math.hypot(dx, dy) / (r.width / 2)))
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 15 : 5
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onPick((hue + step) % 360, sat || 1)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onPick((hue - step + 360) % 360, sat || 1)
    else return
    e.preventDefault()
  }

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
      className={`relative aspect-square shrink-0 cursor-crosshair touch-none rounded-full shadow-lg ring-1 ring-line ${className}`}
      style={{
        background:
          'radial-gradient(circle closest-side, #fff 0%, rgb(255 255 255 / 0) 100%), conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-md"
        style={{ left: `${x}%`, top: `${y}%`, background: wheelColor(hue, sat) }}
      />
    </div>
  )
}

export default ColorWheel
