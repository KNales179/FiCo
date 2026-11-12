import { useId } from 'react'
import {
  LEAF_GRADIENT,
  LETTERS_GRADIENT,
  LOGO_LEAF,
  LOGO_LETTERS,
  LOGO_VIEWBOX,
} from './ficoLogoPaths'

/**
 * The Fico logo inside the app. Unlike the fixed purple app icon (which is
 * what people tap on their phone), this one follows the colour chosen in
 * Settings and the light/dark theme: the letters fade from a deeper shade
 * of the accent to the accent itself, the leaf is a lighter tint of it —
 * the same structure as the original artwork. Colours come from the
 * --logo-* tokens in index.css, so a theme or colour change repaints it
 * instantly (including during the theme switch's circle reveal).
 */
const FicoLogo = ({
  className = 'h-8 w-8',
  title,
}: {
  className?: string
  /** Accessible name; omit when the word "Fico" is already shown next to it. */
  title?: string
}) => {
  const id = useId().replace(/:/g, '')
  const letters = `fico-letters-${id}`
  const leaf = `fico-leaf-${id}`

  return (
    <svg
      viewBox={LOGO_VIEWBOX}
      className={`shrink-0 ${className}`}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={letters} gradientUnits="userSpaceOnUse" {...LETTERS_GRADIENT}>
          <stop offset="0" style={{ stopColor: 'var(--logo-from)' }} />
          <stop offset="1" style={{ stopColor: 'var(--logo-to)' }} />
        </linearGradient>
        <linearGradient id={leaf} gradientUnits="userSpaceOnUse" {...LEAF_GRADIENT}>
          <stop offset="0" style={{ stopColor: 'var(--logo-leaf-from)' }} />
          <stop offset="1" style={{ stopColor: 'var(--logo-leaf-to)' }} />
        </linearGradient>
      </defs>
      <path fill={`url(#${letters})`} d={LOGO_LETTERS} />
      <path fill={`url(#${leaf})`} d={LOGO_LEAF} />
    </svg>
  )
}

export default FicoLogo
