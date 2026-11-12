import {
  type ComponentType,
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'
import { IconX, type IconProps } from '../icons'

/**
 * Small shared UI primitives (Roadmap Phase 25). They wrap the utility classes
 * defined in `index.css` so pages stay consistent and readable.
 */

const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ')

export const Card = ({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={cx('card', className)} {...rest} />
)

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost' | 'danger'
  size?: 'md' | 'sm'
  /** Square, no side padding — for an icon with no label. Pair with `aria-label`. */
  iconOnly?: boolean
}

export const Button = ({
  variant = 'default',
  size = 'md',
  iconOnly = false,
  className,
  type = 'button',
  ...rest
}: ButtonProps) => (
  <button
    type={type}
    className={cx(
      'btn',
      variant === 'primary' && 'btn-primary',
      variant === 'ghost' && 'btn-ghost',
      variant === 'danger' && 'btn-danger',
      size === 'sm' && 'btn-sm',
      iconOnly && 'btn-icon',
      className,
    )}
    {...rest}
  />
)

export const Input = ({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) => (
  <input className={cx('input', className)} {...rest} />
)

export const Select = ({
  className,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className={cx('select', className)} {...rest} />
)

export const Field = ({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) => (
  <label className="block">
    <span className="field-label">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
  </label>
)

/**
 * Every page opens with this banner: an accent icon tile, the title and a
 * one-line description, with the page's own controls on the right — the
 * same "section" look the dashboard's summary card has, so all pages read
 * as one app.
 */
export const PageHeader = ({
  title,
  description,
  actions,
  icon: Icon,
}: {
  title: string
  description?: string
  actions?: ReactNode
  icon?: ComponentType<IconProps>
}) => (
  <div className="page-hero mb-4 flex flex-wrap items-center justify-between gap-3">
    <div className="flex min-w-0 items-center gap-3">
      {Icon && (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-ink shadow-sm">
          <Icon size={21} />
        </span>
      )}
      <div className="min-w-0">
        <h1 className="page-title truncate">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
)

export const EmptyState = ({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) => (
  <div className="rounded-[var(--radius-card)] border border-dashed border-line px-4 py-10 text-center">
    <p className="text-sm font-medium text-ink">{title}</p>
    {children && <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{children}</p>}
  </div>
)

export const Alert = ({ children }: { children: ReactNode }) => (
  <p
    role="alert"
    className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
  >
    {children}
  </p>
)

/**
 * Loading placeholders shaped like the content they stand in for (Roadmap:
 * design skill — "skeletons recommended when structure is known"), instead
 * of a plain "Loading…" that tells you nothing about what's coming.
 * `motion-safe:` keeps the pulse off for anyone who's asked for less motion.
 */
export const Skeleton = ({
  className,
}: {
  className?: string
}) => (
  <div
    aria-hidden="true"
    className={cx('rounded-md bg-panel-2 motion-safe:animate-pulse', className)}
  />
)

/** A handful of skeleton text lines, the last one shorter so it doesn't look like a solid bar. */
export const SkeletonLines = ({
  count = 3,
  className,
}: {
  count?: number
  className?: string
}) => (
  <div className={cx('space-y-2', className)}>
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton
        key={i}
        className={i === count - 1 ? 'h-3.5 w-2/3' : 'h-3.5 w-full'}
      />
    ))}
  </div>
)

/** A card-shaped skeleton — a title-width line plus a few body lines. */
export const SkeletonCard = ({
  lines = 3,
  className,
}: {
  lines?: number
  className?: string
}) => (
  <div className={cx('card', className)}>
    <Skeleton className="h-4 w-1/3" />
    <SkeletonLines count={lines} className="mt-3" />
  </div>
)

/** A row shaped like a list item — an avatar-or-icon spot plus two lines of text. */
export const SkeletonRow = () => (
  <div className="flex items-center gap-3 py-2">
    <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
    <div className="flex-1 space-y-1.5">
      <Skeleton className="h-3.5 w-1/2" />
      <Skeleton className="h-3 w-1/4" />
    </div>
  </div>
)

/**
 * A whole page's worth of placeholder — title, subtitle, and a few cards.
 * The stand-in for a lazily-loaded route while its code downloads, so the
 * content area never falls back to a bare "Loading…" line or a spinner.
 */
export const PageSkeleton = () => (
  <div className="space-y-4" role="status" aria-label="Loading page">
    <div className="space-y-2">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-3.5 w-56 max-w-full" />
    </div>
    <SkeletonCard lines={1} />
    <SkeletonCard lines={3} />
    <SkeletonCard lines={4} />
  </div>
)

/**
 * The whole app frame as placeholders — top bar with brand, nav pills and
 * avatar, then a page skeleton — shown while the very first check of who's
 * signed in is still running, so there's no blank screen or spinner before
 * the real layout appears.
 */
export const AppShellSkeleton = () => (
  <div className="min-h-screen">
    <div className="border-b border-line bg-panel shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-2.5 sm:px-4 lg:px-6">
        <Skeleton className="h-6 w-16" />
        <div className="hidden flex-1 items-center gap-2 lg:flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-20" />
          ))}
        </div>
        <div className="ml-auto">
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
    </div>
    <main className="mx-auto max-w-6xl px-3 py-5 sm:px-4 lg:px-6">
      <PageSkeleton />
    </main>
  </div>
)

/** A centered dialog over a dimmed backdrop — click the backdrop, or the ✕, to close. */
/**
 * A centered dialog over a dimmed backdrop — click the backdrop, the ✕, or
 * press Escape to close. Moves focus into the dialog on open and back to
 * whatever triggered it on close, so opening one from the keyboard doesn't
 * strand focus behind the backdrop (WCAG 2.4.3 / 2.1.2).
 */
export const Modal = ({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) => {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<Element | null>(null)

  useEffect(() => {
    previouslyFocused.current = document.activeElement
    dialogRef.current?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previouslyFocused.current instanceof HTMLElement) {
        previouslyFocused.current.focus()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4 py-8">
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="card relative max-h-full w-full max-w-md overflow-y-auto outline-none"
      >
        <div className="flex items-center justify-between">
          <h2 className="section-title">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:text-ink"
          >
            <IconX size={18} />
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  )
}
