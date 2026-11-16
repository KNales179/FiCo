import { Link } from 'react-router-dom'
import { IconChevronLeft } from './icons'

/**
 * "Back to …" as a real button (Fitts's law): a big, clearly outlined
 * target — at least 44px tall — instead of small grey text that blends
 * into the background and is easy to miss or mis-tap.
 */
const BackLink = ({ to, children }: { to: string; children: string }) => (
  <Link
    to={to}
    data-tag={children.startsWith("Back") ? children : `Back to ${children}`}
    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line bg-panel px-3.5 py-2 text-sm font-semibold text-ink shadow-sm transition-colors hover:border-brand/50 hover:text-brand"
  >
    <IconChevronLeft size={18} />
    {children}
  </Link>
)

export default BackLink
