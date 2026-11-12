import { formatMoney } from '../domain/money'
import { useDisplayCurrency } from '../hooks/useDisplayCurrency'

/**
 * "≈ AED 1,234.00" — the amount in the person's own display currency
 * (Settings → Currency), shown under a figure in the Finance's currency.
 * Renders nothing when that setting is off or no rate is known yet.
 */
const Approx = ({
  minor,
  currency,
  className = '',
}: {
  minor: number
  currency: string
  className?: string
}) => {
  const { convert, target } = useDisplayCurrency()
  const converted = convert(minor, currency)
  if (converted == null || !target) return null
  return (
    <span
      className={`block text-xs font-normal tabular-nums text-muted ${className}`}
      title={`Approximate, at today's ${currency} → ${target} rate — only you see this`}
    >
      ≈ {formatMoney(converted, target)}
    </span>
  )
}

export default Approx
