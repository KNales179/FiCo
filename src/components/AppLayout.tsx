import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import SpaceSwitcher from './SpaceSwitcher'
import SyncStatus from './SyncStatus'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm ${isActive ? 'font-semibold underline' : 'text-gray-600'}`

const AppLayout = () => {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="font-semibold">Fico</span>
          <SpaceSwitcher />
          <nav className="flex items-center gap-3">
            <NavLink to="/" end className={navClass}>
              Dashboard
            </NavLink>
            <NavLink to="/shopping" className={navClass}>
              Shopping
            </NavLink>
            <NavLink to="/bills" className={navClass}>
              Bills
            </NavLink>
            <NavLink to="/analytics" className={navClass}>
              Analytics
            </NavLink>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <SyncStatus />
          <span className="text-sm text-gray-500">{user?.username}</span>
          <button
            onClick={() => void logout()}
            className="border px-3 py-1 text-sm"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="p-4">
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout
