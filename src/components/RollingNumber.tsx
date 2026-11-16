import { useState } from 'react'

/**
 * A number whose digits roll to their new value instead of jumping
 * (balances, totals). Pass the already-formatted text ("₱61,513.00");
 * only the digits roll. `spinOnHover` rolls every digit through 0–9 once
 * when hovered (the front page). Screen readers just get the plain text.
 */
const DIGITS = '01234567890123456789'.split('')

const RollingNumber = ({ value, spinOnHover = false, className = '' }: { value: string; spinOnHover?: boolean; className?: string }) => {
  const [spin, setSpin] = useState(0)
  let digitIndex = 0
  return (
    <span
      className={`rolling-number ${className}`}
      aria-label={value}
      onMouseEnter={spinOnHover ? () => setSpin((n) => n + 1) : undefined}
    >
      {value.split('').map((ch, i) => {
        if (!/\d/.test(ch)) {
          return (
            <span key={`c${i}`} aria-hidden="true">
              {ch}
            </span>
          )
        }
        const order = digitIndex++
        return (
          <span key={`d${i}`} className="roll-digit" aria-hidden="true">
            <span
              key={spin}
              className={`roll-strip${spin ? ' roll-spin' : ''}`}
              style={{ ['--d' as string]: Number(ch), ['--i' as string]: order }}
            >
              {DIGITS.map((d, k) => (
                <span key={k}>{d}</span>
              ))}
            </span>
          </span>
        )
      })}
    </span>
  )
}

export default RollingNumber
