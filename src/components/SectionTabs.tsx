import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import type { IconProps } from './icons'

export interface SectionTab {
  to: string
  label: string
  icon: ComponentType<IconProps>
  active: boolean
  /** A small red count, e.g. open appeals. */
  count?: number
}

/**
 * A page's sections as one bar of tabs (Admin, Activity). Centred on wider
 * screens; on a phone it starts at the left edge and scrolls sideways.
 */
const SectionTabs = ({ tabs, label }: { tabs: SectionTab[]; label: string }) => (
  <nav aria-label={label} className="flex justify-start overflow-x-auto sm:justify-center">
    <ul className="inline-flex shrink-0 gap-1 rounded-xl border border-line bg-panel p-1 text-sm">
      {tabs.map(({ to, label: text, icon: Icon, active, count }) => (
        <li key={to} className="shrink-0">
          <Link
            to={to}
            aria-current={active ? 'page' : undefined}
            className={[
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 font-medium transition-colors',
              active ? 'bg-brand text-brand-ink' : 'text-muted hover:bg-panel-2 hover:text-ink',
            ].join(' ')}
          >
            <Icon size={15} />
            {text}
            {count ? (
              <span className="rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                {count}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  </nav>
)

export default SectionTabs
