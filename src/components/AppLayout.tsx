import { Suspense, useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSpace } from '../hooks/useSpace'
import { useUnseenBadge } from '../hooks/useUnseenBadge'
import { listShoppingLists } from '../features/shopping'
import { listBills } from '../features/bills'
import { listFeedback } from '../services/feedbackService'
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
  IconSparkles,
  IconCompass,
  IconShield,
  IconBell,
  IconChevronDown,
  IconLogOut,
  type IconProps,
} from './icons'
import SpaceSwitcher from './SpaceSwitcher'
import SyncStatus from './SyncStatus'
import BillReminders from './BillReminders'
import WelcomeModal from './WelcomeModal'
import WhatsNewModal from './WhatsNewModal'
import BirthdayGreeting from './BirthdayGreeting'
import NotificationPrompt from './NotificationPrompt'
import InstallPrompt from './InstallPrompt'
import { APP_VERSION } from '../features/whatsNew/changelog'
import PullToRefresh from './PullToRefresh'
import { PageSkeleton } from './ui'
import TourProvider from './tour/TourProvider'
import ThemeToggle from './ThemeToggle'
import FicoLogo from './FicoLogo'
import NoticePopup from './NoticePopup'
import DemoBanner from './DemoBanner'
import { useNotificationPolling, useNotifications } from '../features/notifications'
import { useStaggerIn } from '../lib/motion'

type IconComponent = ComponentType<IconProps>

/** Primary destinations — always visible (bottom bar on mobile, header on desktop). */
const PRIMARY: { to: string; label: string; icon: IconComponent; end?: boolean }[] = [
  { to: '/', label: 'Dashboard', icon: IconHome, end: true },
  { to: '/shopping', label: 'Shopping', icon: IconCart },
  { to: '/bills', label: 'Bills', icon: IconReceipt },
  { to: '/budget', label: 'Budget', icon: IconCalendar },
  { to: '/analytics', label: 'Analytics', icon: IconChart },
]

type MenuItem = { to: string; label: string; icon: IconComponent }

/**
 * Secondary destinations — behind the account menu, in three groups split
 * by dividers: you (account, settings, admin, log out), your Finance's
 * people and structure, and help & info.
 */
const MENU_YOU: MenuItem[] = [
  { to: '/account', label: 'Account', icon: IconUserCircle },
  { to: '/notifications', label: 'Notifications', icon: IconBell },
  { to: '/settings', label: 'Settings', icon: IconSettings },
]
const MENU_FINANCE: MenuItem[] = [
  { to: '/members', label: 'Members', icon: IconUsers },
  { to: '/categories', label: 'Categories', icon: IconTag },
  { to: '/activity', label: 'Activity', icon: IconClock },
]
const MENU_HELP: MenuItem[] = [
  { to: '/tutorial', label: 'How Fico works', icon: IconCompass },
  { to: '/updates', label: 'Updates', icon: IconSparkles },
  { to: '/credits', label: 'Credits', icon: IconInfo },
  { to: '/feedback', label: 'Report & feedback', icon: IconMessage },
]

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
  const location = useLocation()
  const pageRef = useRef<HTMLDivElement>(null)
  // Each page eases in when you arrive on it.
  useStaggerIn(pageRef, location.pathname, { y: 10 })

  // Publishes the sticky header's height as --header-h, so sticky panels
  // further down (the dashboard's left column) sit right under it.
  const headerRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const set = () =>
      document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`)
    set()
    const observer = new ResizeObserver(set)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

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

  // Feedback isn't tied to a Finance/space, so there's no real spaceId to
  // scope the "seen" cursor by — 'admin' is just a fixed, stable key for
  // that cursor's storage slot, same mechanism as everywhere else. Only an
  // admin can even call this endpoint, so a non-admin gets an empty list.
  const fetchOpenFeedback = useCallback(
    () =>
      user?.role === 'ADMIN'
        ? listFeedback().then((res) =>
            res.feedback.filter((f) => f.status === 'OPEN'),
          )
        : Promise.resolve([]),
    [user?.role],
  )
  const feedbackUnseen = useUnseenBadge(
    'feedback',
    'admin',
    user?.id,
    fetchOpenFeedback,
  )

  useNotificationPolling(Boolean(user))
  const { unread: unreadNotifications } = useNotifications()

  // Which primary nav destinations get the little "something new" dot.
  const badges: Record<string, boolean> = {
    '/shopping': shoppingUnseen,
    '/bills': billsUnseen,
    '/admin': feedbackUnseen,
    '/notifications': unreadNotifications > 0,
  }

  const initial = (user?.displayName || user?.username || '?').charAt(0).toUpperCase()
  const youItems = user?.role === 'ADMIN' ? [...MENU_YOU, ADMIN_ITEM] : MENU_YOU

  return (
    <TourProvider>
    <div className="relative isolate min-h-screen">
      <div className="app-backdrop" aria-hidden="true" />
      <DemoBanner />
      <header ref={headerRef} className="sticky top-0 z-20 border-b border-line bg-panel/90 shadow-sm backdrop-blur">
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
        <div className="mx-auto flex max-w-6xl flex-nowrap items-center gap-x-2 px-3 py-2.5 sm:px-4 lg:px-6">
          <span className="flex shrink-0 items-center gap-1.5 text-base font-semibold tracking-tight text-brand">
            <FicoLogo className="h-8 w-8" />
            <span className="hidden sm:inline">Fico</span>
          </span>
          <div data-tour="space" className="flex min-w-0 items-center">
            <SpaceSwitcher />
          </div>

          <nav data-tour="nav" className="ml-1 hidden items-center gap-1 lg:flex">
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
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <NavLink
              to="/notifications"
              aria-label={unreadNotifications ? `Notifications, ${unreadNotifications} unread` : 'Notifications'}
              title="Notifications"
              className={({ isActive }) =>
                `relative flex h-8 w-8 items-center justify-center rounded-lg border border-line transition-colors ${
                  isActive ? 'bg-brand/10 text-brand' : 'bg-panel text-muted hover:bg-panel-2 hover:text-ink'
                }`
              }
            >
              <IconBell size={17} />
              {unreadNotifications > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-[var(--panel)] bg-danger px-1 text-[10px] font-bold leading-none text-white">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </NavLink>
            <div className="relative">
              <button
                type="button"
                data-tour="profile"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg border border-line bg-panel py-1 pl-1 pr-2 text-sm font-medium text-ink transition-colors hover:bg-panel-2"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="relative inline-flex">
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
                  {feedbackUnseen && (
                    <span
                      aria-label="New, not yet seen"
                      className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-panel bg-danger"
                    />
                  )}
                </span>
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
                    {[youItems, MENU_FINANCE, MENU_HELP].map((group, groupIndex) => (
                      <div
                        key={groupIndex}
                        role="group"
                        className={groupIndex > 0 ? 'mt-1 border-t border-line pt-1' : undefined}
                      >
                        {group.map((item) => {
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
                              <span className="relative inline-flex">
                                <ItemIcon size={17} />
                                {badges[item.to] && (
                                  <span
                                    aria-label="New, not yet seen"
                                    className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-danger"
                                  />
                                )}
                              </span>
                              {item.label}
                            </NavLink>
                          )
                        })}
                        {groupIndex === 0 && (
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
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Its own row, always — never sharing space with (or wrapping onto
            the same line as) the nav or the profile button above. */}
        <div className="mx-auto max-w-6xl px-3 pb-2 sm:px-4 lg:px-6">
          <SyncStatus />
        </div>
      </header>

      <BillReminders />
      <WelcomeModal />
      <WhatsNewModal />
      <BirthdayGreeting />
      <NoticePopup />
      <InstallPrompt />
      <NotificationPrompt />
      <PullToRefresh />

      <main className="mx-auto max-w-6xl px-3 py-5 pb-28 sm:px-4 lg:px-6 lg:py-7 lg:pb-8">
        {/* Suspense here (not just at the app root) so the header and nav
            stay on screen while a page's code downloads — only the content
            area shows a skeleton. */}
        <div ref={pageRef}>
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </div>

        <footer className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span>© {new Date().getFullYear()} IBell. All rights reserved.</span>
          {/* Plain text on purpose — bumped with every release (features/whatsNew/changelog.ts). */}
          <span>Fico v{APP_VERSION}</span>
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

      {/* Bottom navigation — phones and tablets (anything under laptop width). */}
      <nav
        data-tour="nav"
        data-bottom-nav
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
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
    </TourProvider>
  )
}

export default AppLayout
