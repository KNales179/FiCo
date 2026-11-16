import { useEffect, useState, type ComponentType } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { listAppeals } from '../../services/appealService'
import { IconMessage, IconShield, IconTicket, IconUsers, type IconProps } from '../icons'

type Section = {
  to: string
  label: string
  icon: ComponentType<IconProps>
  /** Also lit up for pages under it (a user's profile, one appeal). */
  match: (path: string) => boolean
}

const SECTIONS: Section[] = [
  { to: '/admin', label: 'Users', icon: IconUsers, match: (p) => p === '/admin' || p.startsWith('/admin/users') },
  { to: '/admin/invites', label: 'Invite codes', icon: IconTicket, match: (p) => p.startsWith('/admin/invites') },
  { to: '/admin/appeals', label: 'Appeals', icon: IconShield, match: (p) => p.startsWith('/admin/appeals') },
  { to: '/admin/feedback', label: 'Report & feedback', icon: IconMessage, match: (p) => p.startsWith('/admin/feedback') },
]

/**
 * Every Admin page sits under one bar of sections, so each part (users,
 * invite codes, appeals, reports) is one tap away instead of buried in a
 * single long page.
 */
const AdminLayout = () => {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const [openAppeals, setOpenAppeals] = useState(0)
  const isAdmin = user?.role === 'ADMIN'

  useEffect(() => {
    if (!isAdmin) return
    listAppeals()
      .then((res) => setOpenAppeals(res.open))
      .catch(() => undefined)
  }, [isAdmin, pathname])

  if (user && !isAdmin) return <Navigate to="/" replace />

  return (
    <div className="space-y-4">
      <nav aria-label="Admin sections" className="flex justify-start overflow-x-auto sm:justify-center">
        <ul className="inline-flex shrink-0 gap-1 rounded-xl border border-line bg-panel p-1 text-sm">
          {SECTIONS.map(({ to, label, icon: Icon, match }) => {
            const active = match(pathname)
            return (
              <li key={to} className="shrink-0">
                <NavLink
                  to={to}
                  end
                  aria-current={active ? 'page' : undefined}
                  className={[
                    'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 font-medium transition-colors',
                    active ? 'bg-brand text-brand-ink' : 'text-muted hover:bg-panel-2 hover:text-ink',
                  ].join(' ')}
                >
                  <Icon size={15} />
                  {label}
                  {to === '/admin/appeals' && openAppeals > 0 && (
                    <span className="rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                      {openAppeals}
                    </span>
                  )}
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>
      <Outlet />
    </div>
  )
}

export default AdminLayout
