import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/**
 * Sign-in and sign-up are for people who aren't signed in. Someone who
 * already is (a bookmark, the back button, a shared link) goes to their
 * dashboard instead of seeing a form they don't need.
 */
const GuestRoute = () => {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) return <Navigate to="/" replace />
  return <Outlet />
}

export default GuestRoute
