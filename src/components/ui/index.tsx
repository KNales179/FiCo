import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'
import { IconX } from '../icons'

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

export const PageHeader = ({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) => (
  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
    <div>
      <h1 className="page-title">{title}</h1>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
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
