import { useEffect, useRef, useState } from 'react'
import { useSpace } from '../../hooks/useSpace'
import { updateSpaceCurrency } from '../../services/spaceService'
import { SUPPORTED_CURRENCIES, currencyName } from '../../domain/money'
import { gsap, prefersReducedMotion } from '../../lib/motion'
import { Button, Select } from '../ui'
import { IconRotateCcw } from '../icons'

const UNDO_MS = 30_000

/**
 * The shared Finance's own currency — every account created in it defaults
 * to this. Unlike the personal display currency, changing it affects
 * everyone in the Finance, so it asks first (with exactly what will and
 * won't happen) and offers Undo for a while afterwards. Owner only.
 */
const FinanceCurrency = () => {
  const { activeSpace, refresh, demo } = useSpace()
  const [choice, setChoice] = useState(activeSpace?.currency ?? 'PHP')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [undo, setUndo] = useState<{ from: string; to: string } | null>(null)
  const warnRef = useRef<HTMLDivElement>(null)

  const current = activeSpace?.currency ?? 'PHP'
  const isOwner = activeSpace?.role === 'OWNER'
  const shared = activeSpace?.type === 'FAMILY'

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoice(current)
  }, [current])

  useEffect(() => {
    if (!undo) return
    const t = window.setTimeout(() => setUndo(null), UNDO_MS)
    return () => window.clearTimeout(t)
  }, [undo])

  useEffect(() => {
    const el = warnRef.current
    if (!confirming || !el || prefersReducedMotion()) return
    const tween = gsap.from(el, { autoAlpha: 0, y: -6, duration: 0.3, ease: 'power2.out' })
    return () => {
      tween.kill()
    }
  }, [confirming])

  if (!activeSpace) return null

  const apply = async (to: string, from: string, isUndo = false) => {
    setError('')
    setBusy(true)
    try {
      await updateSpaceCurrency(activeSpace.id, to)
      await refresh()
      setConfirming(false)
      setUndo(isUndo ? null : { from, to })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the currency')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={choice}
          onChange={(e) => {
            setChoice(e.target.value)
            setConfirming(false)
          }}
          disabled={!isOwner || demo || busy}
          className="w-auto"
          aria-label={`${activeSpace.name}'s currency`}
          title={currencyName(choice)}
        >
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c} — {currencyName(c)}
            </option>
          ))}
        </Select>
        {isOwner && choice !== current && !confirming && (
          <Button size="sm" variant="primary" onClick={() => setConfirming(true)}>
            Change…
          </Button>
        )}
      </div>

      {!isOwner && (
        <p className="text-xs text-muted">Only the owner of {activeSpace.name} can change this.</p>
      )}

      {confirming && (
        <div
          ref={warnRef}
          role="alertdialog"
          aria-label="Confirm currency change"
          className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm"
        >
          <p className="font-semibold text-warning">
            Change {activeSpace.name} from {current} to {choice}
            {shared ? ' for everyone?' : '?'}
          </p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs text-ink">
            {shared && <li>Everyone in this Finance will see this change.</li>}
            <li>New accounts will start in {choice}.</li>
            <li>
              Nothing already recorded is converted — existing accounts and records keep their
              own currency.
            </li>
            <li>Just want to see amounts in {choice} for yourself? Use “Your currency” above instead.</li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="primary" disabled={busy} onClick={() => void apply(choice, current)}>
              {busy ? 'Changing…' : `Yes, change to ${choice}`}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setConfirming(false)
                setChoice(current)
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {undo && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-panel-2 px-3 py-2 text-sm">
          <span className="text-ink">
            Changed to <strong>{undo.to}</strong>.
          </span>
          <Button size="sm" disabled={busy} onClick={() => void apply(undo.from, undo.to, true)}>
            <IconRotateCcw size={13} />
            Undo
          </Button>
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}

export default FinanceCurrency
