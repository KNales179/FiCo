import type { MouseEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuthNav } from './authNav'

/** A link between sign-in screens that plays the slide transition. */
const AuthLink = ({ to, className, children }: { to: string; className?: string; children: ReactNode }) => {
  const { go } = useAuthNav()
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Let ctrl/cmd-click etc. open a new tab as usual.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    go(to)
  }
  return (
    <Link to={to} onClick={onClick} className={className}>
      {children}
    </Link>
  )
}

export default AuthLink
