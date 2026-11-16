import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { isRunningInstalled } from '../features/pwa/installPrompt'
import { hasSignedInBefore } from '../features/auth/returning'
import { lazyPage } from '../lib/lazyPage'
import { AppShellSkeleton } from './ui'

const Landing = lazyPage(() => import('../pages/Landing'))

const ProtectedRoute = () => {
  const { isAuthenticated, loading } = useAuth()
  const { pathname } = useLocation()

  if (loading) return <AppShellSkeleton />

  if (!isAuthenticated) {
    // The website's front page is for first-time visitors in a browser. The
    // installed app is the app itself, and anyone who has signed in here
    // before goes straight to signing in (where any "your changes were kept"
    // or "you were signed out" message is waiting).
    if (pathname === '/' && !isRunningInstalled() && !hasSignedInBefore()) return <Landing />
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export default ProtectedRoute
