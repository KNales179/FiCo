import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { isRunningInstalled } from '../features/pwa/installPrompt'
import { justSignedOut } from '../features/auth/returning'
import { lazyPage } from '../lib/lazyPage'
import { AppShellSkeleton } from './ui'

const Landing = lazyPage(() => import('../pages/Landing'))

const ProtectedRoute = () => {
  const { isAuthenticated, loading } = useAuth()
  const { pathname } = useLocation()

  if (loading) return <AppShellSkeleton />

  if (!isAuthenticated) {
    // In a browser, the main address is the website's front page. The
    // installed app is the app itself, and someone who was just signed out
    // goes to the sign-in screen, where "your changes were kept" or "you
    // were signed out because…" is waiting.
    if (pathname === '/' && !isRunningInstalled() && !justSignedOut()) return <Landing />
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export default ProtectedRoute
