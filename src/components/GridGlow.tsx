import { useEffect } from 'react'

/**
 * Drives the grid hover glow (see "Grid hover glow" in index.css): keeps
 * the cursor's screen position in --spot-x/--spot-y on <html>. Renders
 * nothing. Only for a real mouse (not touch), never with reduced motion,
 * and at most one update per frame.
 */
const GridGlow = () => {
  useEffect(() => {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const root = document.documentElement
    let raf = 0
    let x = -999
    let y = -999
    const paint = () => {
      raf = 0
      root.style.setProperty('--spot-x', `${x}px`)
      root.style.setProperty('--spot-y', `${y}px`)
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(paint)
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      x = e.clientX
      y = e.clientY
      schedule()
    }
    // Left the window, or switched away: hide the glow until the mouse is back.
    const hide = () => {
      x = -999
      y = -999
      schedule()
    }
    const onOut = (e: MouseEvent) => {
      if (!e.relatedTarget) hide()
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('mouseout', onOut)
    window.addEventListener('blur', hide)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('mouseout', onOut)
      window.removeEventListener('blur', hide)
      if (raf) cancelAnimationFrame(raf)
      root.style.removeProperty('--spot-x')
      root.style.removeProperty('--spot-y')
    }
  }, [])
  return null
}

export default GridGlow
