import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react'
import { gsap, prefersReducedMotion } from '../lib/motion'
import { OPEN_SECTION_EVENT as OPEN_EVENT } from '../lib/sections'
import { IconChevronDown, type IconProps } from './icons'
import SuccessCheck from './SuccessCheck'
import { CELEBRATE_EVENT } from '../features/ui/celebrate'

const STORAGE_KEY = 'fico.collapsed'


const readCollapsed = (): Record<string, boolean> => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, boolean>
  } catch {
    return {}
  }
}

const writeCollapsed = (id: string, collapsed: boolean) => {
  try {
    const all = readCollapsed()
    all[id] = collapsed
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    // Storage blocked — it just won't be remembered.
  }
}

/**
 * A card whose title is its own open/close switch (owner request: "the
 * expand and collapse button is the content name"). Open by default; each
 * person folds away what they don't need, and that's remembered on this
 * device per section. Opening and closing glide with GSAP (instant for
 * reduced motion).
 */
const CollapsibleCard = ({
  id,
  title,
  icon: Icon,
  actions,
  children,
  className = '',
  dataTour,
  subtitle,
  defaultOpen = true,
}: {
  /** Stable key for remembering open/closed, e.g. "bills.paid". */
  id: string
  title: ReactNode
  icon?: ComponentType<IconProps>
  /** Buttons on the right of the title row (stay visible when folded). */
  actions?: ReactNode
  children: ReactNode
  className?: string
  dataTour?: string
  /** Small text shown next to the title only while folded (e.g. a count). */
  subtitle?: ReactNode
  /** Start folded until the person opens it (remembered after that). */
  defaultOpen?: boolean
}) => {
  const [open, setOpen] = useState(() => {
    const saved = readCollapsed()[id]
    return saved === undefined ? defaultOpen : !saved
  })
  const bodyRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const first = useRef(true)

  useLayoutEffect(() => {
    const el = bodyRef.current
    if (!el) return
    if (first.current) {
      first.current = false
      return
    }
    if (prefersReducedMotion()) return
    gsap.killTweensOf(el)
    if (open) {
      gsap.fromTo(
        el,
        { height: 0, autoAlpha: 0, overflow: 'hidden' },
        // Fast, then slow: most of the height arrives at once, the rest settles in.
        { height: 'auto', autoAlpha: 1, duration: 0.55, ease: 'expo.out', clearProps: 'height,opacity,visibility,overflow' },
      )
    }
  }, [open])

  // A success check next to the title (celebrate(id) after an action works).
  // It briefly takes the arrow's place, so it never squeezes the title.
  const [cheers, setCheers] = useState(0)
  const [cheering, setCheering] = useState(false)
  useEffect(() => {
    let timer = 0
    const onCheer = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) return
      setCheers((n) => n + 1)
      setCheering(true)
      // Secondary flourish: the whole card gives one soft pulse in the accent.
      const card = sectionRef.current
      if (card) {
        card.classList.remove('celebrate-pulse')
        void card.offsetWidth
        card.classList.add('celebrate-pulse')
      }
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setCheering(false), 1600)
    }
    window.addEventListener(CELEBRATE_EVENT, onCheer)
    return () => {
      window.removeEventListener(CELEBRATE_EVENT, onCheer)
      window.clearTimeout(timer)
    }
  }, [id])

  useEffect(() => {
    const onOpen = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) return
      writeCollapsed(id, false)
      setOpen(true)
    }
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [id])

  const toggle = useCallback(() => {
    const el = bodyRef.current
    const next = !open
    writeCollapsed(id, !next)
    if (!next && el && !prefersReducedMotion()) {
      gsap.killTweensOf(el)
      gsap.set(el, { overflow: 'hidden' })
      gsap.to(el, {
        height: 0,
        autoAlpha: 0,
        duration: 0.28,
        ease: 'power3.out',
        onComplete: () => {
          setOpen(false)
          gsap.set(el, { clearProps: 'height,opacity,visibility,overflow' })
        },
      })
      return
    }
    setOpen(next)
  }, [id, open])

  return (
    <section ref={sectionRef} className={`card ${className}`} data-tour={dataTour}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="group -m-1 flex min-w-0 items-center gap-2 rounded-lg p-1 text-left"
        >
          {Icon && (
            <span className="card-icon">
              <Icon size={16} />
            </span>
          )}
          <span className="section-title truncate">{title}</span>
          {!open && subtitle && <span className="truncate text-xs text-muted">{subtitle}</span>}
          {cheering ? (
            <SuccessCheck key={cheers} />
          ) : (
            <IconChevronDown
              size={16}
              className={`shrink-0 text-muted transition-transform duration-300 group-hover:text-ink ${open ? '' : '-rotate-90'}`}
            />
          )}
        </button>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div ref={bodyRef} hidden={!open}>
        <div className="pt-3">{children}</div>
      </div>
    </section>
  )
}

export default CollapsibleCard
