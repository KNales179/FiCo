import { useCallback, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSpace } from '../hooks/useSpace'
import { useUnseenBadge } from '../hooks/useUnseenBadge'
import { listShoppingLists } from '../features/shopping'
import { listBills } from '../features/bills'
import SpaceSwitcher from './SpaceSwitcher'
import SyncStatus from './SyncStatus'
import BillReminders from './BillReminders'

/** Primary destinations — always visible (bottom bar on mobile, header on desktop). */
const PRIMARY = [
  { to: '/', label: 'Dashboard', icon: '◎', end: true },
  { to: '/shopping', label: 'Shopping', icon: '🛒' },
  { to: '/bills', label: 'Bills', icon: '🧾' },
  { to: '/budget', label: 'Budget', icon: '📅' },
  { to: '/analytics', label: 'Analytics', icon: '📊' },
] as const

/** Secondary destinations — behind a "More" menu. */
const SECONDARY = [
  { to: '/categories', label: 'Categories' },
  { to: '/members', label: 'Members' },
  { to: '/activity', label: 'Activity' },
  { to: '/account', label: 'Account' },
  { to: '/feedback', label: 'Report & feedback' },
] as const

/** Only shown to a system-wide admin — separate from a Finance's own owner. */
const ADMIN_ITEM = { to: '/admin', label: 'Admin' } as const

const primaryLink = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-panel-2 text-ink'
      : 'text-muted hover:bg-panel-2 hover:text-ink'
  }`

const AppLayout = () => {
  const { user, logout } = useAuth()
  const { activeSpaceId } = useSpace()
  const [menuOpen, setMenuOpen] = useState(false)

  const fetchShoppingLists = useCallback(
    () => (activeSpaceId ? listShoppingLists(activeSpaceId) : Promise.resolve([])),
    [activeSpaceId],
  )
  const shoppingUnseen = useUnseenBadge(
    'shopping',
    activeSpaceId,
    user?.id,
    fetchShoppingLists,
  )

  const fetchBills = useCallback(
    () => (activeSpaceId ? listBills(activeSpaceId) : Promise.resolve([])),
    [activeSpaceId],
  )
  const billsUnseen = useUnseenBadge('bills', activeSpaceId, user?.id, fetchBills)

  // Which primary nav destinations get the little "something new" dot.
  const badges: Partial<Record<(typeof PRIMARY)[number]['to'], boolean>> = {
    '/shopping': shoppingUnseen,
    '/bills': billsUnseen,
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-panel/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-base font-semibold tracking-tight text-brand">
            <img src="/icon-192.png" alt="" className="h-7 w-7 rounded-md" />
            Fico
          </span>
          <SpaceSwitcher />

          <nav className="ml-1 hidden items-center gap-1 md:flex">
            {PRIMARY.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={'end' in item ? item.end : undefined}
                className={primaryLink}
              >
                <span className="relative">
                  {item.label}
                  {badges[item.to] && (
                    <span
                      aria-label="New, not yet seen"
                      className="absolute -right-2 -top-0.5 h-1.5 w-1.5 rounded-full bg-danger"
                    />
                  )}
                </span>
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <SyncStatus />
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="btn btn-sm"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                {user?.displayName || user?.username} ▾
              </button>
              {menuOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Close menu"
                    className="fixed inset-0 z-10 cursor-default"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div
                    role="menu"
                    className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-line bg-panel py-1 shadow-lg"
                  >
                    {(user?.role === 'ADMIN' ? [...SECONDARY, ADMIN_ITEM] : SECONDARY).map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                        className={({ isActive }) =>
                          `block px-3 py-2 text-sm ${
                            isActive
                              ? 'bg-panel-2 text-ink'
                              : 'text-muted hover:bg-panel-2 hover:text-ink'
                          }`
                        }
                      >
                        {item.label}
                      </NavLink>
                    ))}
                    <div className="my-1 border-t border-line" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false)
                        void logout()
                      }}
                      className="block w-full px-3 py-2 text-left text-sm text-muted hover:bg-panel-2 hover:text-ink"
                    >
                      Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <BillReminders />

      <main className="mx-auto max-w-4xl px-4 py-5 pb-24 md:pb-5">
        <Outlet />
      </main>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-panel/95 backdrop-blur md:hidden">
        {PRIMARY.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={'end' in item ? item.end : undefined}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
                isActive ? 'text-brand' : 'text-muted'
              }`
            }
          >
            <span aria-hidden="true" className="relative text-base leading-none">
              {item.icon}
              {badges[item.to] && (
                <span
                  aria-label="New, not yet seen"
                  className="absolute -right-1 -top-0.5 h-1.5 w-1.5 rounded-full bg-danger"
                />
              )}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export default AppLayout
