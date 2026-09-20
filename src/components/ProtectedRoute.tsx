import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { AppShellSkeleton } from './ui'

const ProtectedRoute = () => {
  const { isAuthenticated, loading } = useAuth()

  if (loading) return <AppShellSkeleton />

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export default ProtectedRoute