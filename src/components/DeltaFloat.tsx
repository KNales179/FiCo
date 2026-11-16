import { useEffect, useRef, useState, type ReactNode } from 'react'
import { formatMoney } from '../domain/money'

/**
 * A secondary flourish for a changing balance: as the number rolls to its
 * new value, a small "+₱1,234" / "−₱1,234" floats up beside it and fades.
 * Not on first load — only when the amount actually changes.
 */
const DeltaFloat = ({ amount, currency, children }: { amount: number; currency: string; children: ReactNode }) => {
  const previous = useRef<number | null>(null)
  const [floats, setFloats] = useState<Array<{ id: number; diff: number }>>([])

  useEffect(() => {
    const before = previous.current
    previous.current = amount
    if (before === null || before === amount) return
    const id = Date.now() + Math.random()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFloats((list) => [...list, { id, diff: amount - before }])
    const timer = window.setTimeout(() => setFloats((list) => list.filter((f) => f.id !== id)), 1500)
    return () => window.clearTimeout(timer)
  }, [amount])

  return (
    <span className="relative inline-block">
      {children}
      {floats.map((f) => (
        <span key={f.id} className={`delta-float ${f.diff > 0 ? 'text-success' : 'text-danger'}`} aria-hidden="true">
          {f.diff > 0 ? '+' : '−'}
          {formatMoney(Math.abs(f.diff), currency)}
        </span>
      ))}
    </span>
  )
}

export default DeltaFloat
