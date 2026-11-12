import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSpace } from '../hooks/useSpace'
import { gsap, prefersReducedMotion } from '../lib/motion'
import { IconCheck, IconChevronDown, IconPlus, IconUsers, IconWallet, IconX } from './icons'
import { Skeleton } from './ui'

/** How many Finances one person can own (shared ones they've joined don't count). */
const MAX_OWNED_FINANCES = 3

/**
 * The Finance picker in the header: tap it for the list of your Finances,
 * with "Add another Finance" at the bottom (up to three of your own).
 */
const SpaceSwitcher = () => {
  const { spaces, activeSpaceId, loading, fromCache, switchSpace, createSpace } = useSpace()

  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const active = spaces.find((s) => s.id === activeSpaceId)
  const owned = spaces.filter((s) => s.role === 'OWNER').length
  const atLimit = owned >= MAX_OWNED_FINANCES

  const close = () => {
    setOpen(false)
    setCreating(false)
    setName('')
    setError('')
  }

  // Click outside / Escape closes it.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    const el = panelRef.current
    if (!open || !el || prefersReducedMotion()) return
    const tween = gsap.fromTo(
      el,
      { autoAlpha: 0, y: -6, scale: 0.98 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.18, ease: 'power2.out', clearProps: 'transform,opacity,visibility' },
    )
    return () => {
      tween.kill()
    }
  }, [open])

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    setError('')
    try {
      await createSpace(trimmed)
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create that Finance')
    } finally {
      setBusy(false)
    }
  }

  if (loading && spaces.length === 0) {
    return <Skeleton className="h-7 w-24" />
  }

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Switch Finance"
        className="flex min-w-0 max-w-[9.5rem] items-center gap-1.5 rounded-lg border border-line bg-field px-2.5 py-1 text-sm font-medium text-ink transition-colors hover:border-brand/60 sm:max-w-[15rem]"
      >
        <span className="truncate">{active?.name ?? (spaces.length ? 'Pick a Finance' : 'No Finance yet')}</span>
        <IconChevronDown size={14} className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {fromCache && <span className="text-xs text-amber-600">Offline — showing your last known spaces</span>}

      {open && (
        <div
          ref={panelRef}
          className="absolute left-0 top-full z-40 mt-2 w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-line bg-panel shadow-xl"
        >
          <p className="px-3 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted">Your Finances</p>
          <ul role="listbox" aria-label="Finances" className="max-h-72 overflow-y-auto px-1.5 pb-1.5">
            {spaces.map((space) => {
              const selected = space.id === activeSpaceId
              const Icon = space.type === 'FAMILY' ? IconUsers : IconWallet
              return (
                <li key={space.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      close()
                      if (!selected) void switchSpace(space.id)
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left text-sm transition-colors ${
                      selected ? 'bg-brand/10 text-ink' : 'text-ink hover:bg-panel-2'
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        selected ? 'bg-brand text-brand-ink' : 'bg-panel-2 text-muted'
                      }`}
                    >
                      <Icon size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{space.name}</span>
                      <span className="block text-xs text-muted">
                        {space.type === 'FAMILY' ? 'Shared' : 'Personal'}
                        {space.role !== 'OWNER' ? ` · ${space.role.toLowerCase()}` : ''}
                      </span>
                    </span>
                    {selected && <IconCheck size={16} className="shrink-0 text-brand" />}
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="border-t border-line p-1.5">
            {creating ? (
              <form onSubmit={handleCreate} className="space-y-2 p-1.5">
                <input
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Name it, e.g. Family Expenses"
                  maxLength={60}
                  className="input py-1.5 text-sm"
                />
                <div className="flex gap-2">
                  <button type="submit" disabled={busy || !name.trim()} className="btn btn-primary btn-sm flex-1">
                    {busy ? 'Creating…' : 'Create Finance'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false)
                      setError('')
                    }}
                    className="btn btn-sm"
                    aria-label="Cancel"
                  >
                    <IconX size={14} />
                  </button>
                </div>
              </form>
            ) : atLimit ? (
              <p className="px-2 py-2 text-xs text-muted">
                You have {owned} of {MAX_OWNED_FINANCES} Finances of your own — that's the most for now. Finances
                others share with you don't count.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left text-sm font-medium text-brand transition-colors hover:bg-brand/10"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-dashed border-brand/50">
                  <IconPlus size={15} />
                </span>
                <span className="flex-1">Add another Finance</span>
                <span className="text-xs font-normal text-muted">
                  {owned}/{MAX_OWNED_FINANCES}
                </span>
              </button>
            )}
            {error && (
              <p role="alert" className="px-2 pb-1 text-xs text-danger">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SpaceSwitcher
