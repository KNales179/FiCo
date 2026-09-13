import { useCallback, useState, type ComponentType } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSpace } from '../hooks/useSpace'
import { useUnseenBadge } from '../hooks/useUnseenBadge'
import { listShoppingLists } from '../features/shopping'
import { listBills } from '../features/bills'
import {
  IconHome,
  IconCart,
  IconReceipt,
  IconCalendar,
  IconChart,
  IconTag,
  IconUsers,
  IconClock,
  IconUserCircle,
  IconSettings,
  IconMessage,
  IconInfo,
  IconShield,
  IconChevronDown,
  IconLogOut,
  type IconProps,
} from './icons'
import SpaceSwitcher from './SpaceSwitcher'
import SyncStatus from './SyncStatus'
import BillReminders from './BillReminders'

type IconComponent = ComponentType<IconProps>

/** Primary destinations — always visible (bottom bar on mobile, header on desktop). */
const PRIMARY: { to: string; label: string; icon: IconComponent; end?: boolean }[] = [
  { to: '/', label: 'Dashboard', icon: IconHome, end: true },
  { to: '/shopping', label: 'Shopping', icon: IconCart },
  { to: '/bills', label: 'Bills', icon: IconReceipt },
  { to: '/budget', label: 'Budget', icon: IconCalendar },
  { to: '/analytics', label: 'Analytics', icon: IconChart },
]

/** Secondary destinations — behind the account menu. */
const SECONDARY: { to: string; label: string; icon: IconComponent }[] = [
  { to: '/categories', label: 'Categories', icon: IconTag },
  { to: '/members', label: 'Members', icon: IconUsers },
  { to: '/activity', label: 'Activity', icon: IconClock },
  { to: '/account', label: 'Account', icon: IconUserCircle },
  { to: '/settings', label: 'Settings', icon: IconSettings },
  { to: '/credits', label: 'Credits', icon: IconInfo },
  { to: '/feedback', label: 'Report & feedback', icon: IconMessage },
]

/** Only shown to a system-wide admin — separate from a Finance's own owner. */
const ADMIN_ITEM = { to: '/admin', label: 'Admin', icon: IconShield }

const primaryLink = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-brand/10 text-brand'
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
  const badges: Record<string, boolean> = {
    '/shopping': shoppingUnseen,
    '/bills': billsUnseen,
  }

  const initial = (user?.displayName || user?.username || '?').charAt(0).toUpperCase()
  const menuItems = user?.role === 'ADMIN' ? [...SECONDARY, ADMIN_ITEM] : SECONDARY

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-panel/90 shadow-sm backdrop-blur">
        {/* Always flex-nowrap, on every width — wrapping just traded "the
            profile button clips off-screen" for "the header grows a second
            line and pushes the whole page down," neither of which is
            actually correct. The real fix is making sure the content itself
            (space switcher, +New) shrinks enough to fit on mobile — see
            SpaceSwitcher's max-width and its icon-only +New button below.
            Deliberately NOT overflow-x-auto here — setting overflow-x to
            anything but visible forces overflow-y to clip too (the two axes
            can't be mixed), which was silently clipping the profile
            dropdown menu below the row instead of showing it. */}
        <div className="mx-auto flex max-w-5xl flex-nowrap items-center gap-x-2 px-3 py-2.5 sm:px-4">
          <span className="flex shrink-0 items-center gap-1.5 text-base font-semibold tracking-tight text-brand">
            <img src="/icon-192.png" alt="" className="h-7 w-7 rounded-md" />
            <span className="hidden sm:inline">Fico</span>
          </span>
          <SpaceSwitcher />

          <nav className="ml-1 hidden items-center gap-1 md:flex">
            {PRIMARY.map((item) => {
              const ItemIcon = item.icon
              return (
                <NavLink key={item.to} to={item.to} end={item.end} className={primaryLink}>
                  <span className="relative">
                    <ItemIcon size={18} />
                    {badges[item.to] && (
                      <span
                        aria-label="New, not yet seen"
                        className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-danger"
                      />
                    )}
                  </span>
                  {/* Labels only once there's real room for them (xl) — an
                      icon-only nav at md/lg guarantees the profile button
                      still fits right beside Analytics on the same line,
                      never wrapping onto its own row. */}
                  <span className="hidden xl:inline">{item.label}</span>
                </NavLink>
              )
            })}
          </nav>

          {/* Always right after the nav, on the same line, at every width —
              never bundled with (or wrapped together with) the sync status,
              which lives on its own row below the header instead. */}
          <div className="ml-auto flex shrink-0 items-center">
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg border border-line bg-panel py-1 pl-1 pr-2 text-sm font-medium text-ink transition-colors hover:bg-panel-2"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="h-6 w-6 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-ink">
                    {initial}
                  </span>
                )}
                <span className="hidden sm:inline">{user?.displayName || user?.username}</span>
                <IconChevronDown size={16} className="text-muted" />
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
                    className="absolute right-0 z-20 mt-1.5 w-52 overflow-hidden rounded-lg border border-line bg-panel py-1 shadow-lg"
                  >
                    {menuItems.map((item) => {
                      const ItemIcon = item.icon
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          role="menuitem"
                          onClick={() => setMenuOpen(false)}
                          className={({ isActive }) =>
                            `flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                              isActive
                                ? 'bg-brand/10 text-brand'
                                : 'text-muted hover:bg-panel-2 hover:text-ink'
                            }`
                          }
                        >
                          <ItemIcon size={17} />
                          {item.label}
                        </NavLink>
                      )
                    })}
                    <div className="my-1 border-t border-line" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false)
                        void logout()
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                    >
                      <IconLogOut size={17} />
                      Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Its own row, always — never sharing space with (or wrapping onto
            the same line as) the nav or the profile button above. */}
        <div className="mx-auto max-w-5xl px-3 pb-2 sm:px-4">
          <SyncStatus />
        </div>
      </header>

      <BillReminders />

      <main className="mx-auto max-w-5xl px-3 py-5 pb-24 sm:px-4 md:pb-5">
        <Outlet />

        <footer className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span>© {new Date().getFullYear()} IBell. All rights reserved.</span>
          <Link to="/credits" className="underline">
            Credits
          </Link>
          <Link to="/terms" className="underline">
            Terms
          </Link>
          <Link to="/privacy" className="underline">
            Privacy
          </Link>
        </footer>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-panel/95 backdrop-blur md:hidden">
        {PRIMARY.map((item) => {
          const ItemIcon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
                  isActive ? 'text-brand' : 'text-muted'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`relative flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                      isActive ? 'bg-brand/10' : ''
                    }`}
                  >
                    <ItemIcon size={19} />
                    {badges[item.to] && (
                      <span
                        aria-label="New, not yet seen"
                        className="absolute right-0 top-0 h-1.5 w-1.5 rounded-full bg-danger"
                      />
                    )}
                  </span>
                  {item.label}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}

export default AppLayout
