import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { listAppeals } from '../../services/appealService'
import SectionTabs from '../SectionTabs'
import { IconMessage, IconShield, IconTicket, IconUsers } from '../icons'

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

  // Only once the role is known: on start-up the saved account may not have
  // it yet (the server's answer fills it in a moment later).
  if (user?.role && !isAdmin) return <Navigate to="/" replace />

  return (
    <div className="space-y-4">
      <SectionTabs
        label="Admin sections"
        tabs={[
          // A user's profile lights up Users; one appeal lights up Appeals.
          { to: '/admin', label: 'Users', icon: IconUsers, active: pathname === '/admin' || pathname.startsWith('/admin/users') },
          { to: '/admin/invites', label: 'Invite codes', icon: IconTicket, active: pathname.startsWith('/admin/invites') },
          {
            to: '/admin/appeals',
            label: 'Appeals',
            icon: IconShield,
            active: pathname.startsWith('/admin/appeals'),
            count: openAppeals,
          },
          { to: '/admin/feedback', label: 'Report & feedback', icon: IconMessage, active: pathname.startsWith('/admin/feedback') },
        ]}
      />
      <Outlet />
    </div>
  )
}

export default AdminLayout
