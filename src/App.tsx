import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AuthProvider } from './context/AuthContext'
import { SpaceProvider } from './context/SpaceProvider'
import { SyncProvider } from './context/SyncProvider'
import { MoneyProvider } from './context/MoneyProvider'
import { ShoppingProvider } from './context/ShoppingProvider'
import { BillsProvider } from './context/BillsProvider'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'
import ConnectionStatus from './components/ConnectionStatus'
import UpdateBanner from './components/UpdateBanner'
import IntroSplash from './components/IntroSplash'
import AuthLayout from './components/auth/AuthLayout'
import { PageSkeleton } from './components/ui'

import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'
import Home from './pages/Home'

// Secondary routes are split out of the initial bundle (Roadmap Phase 26).
const Shopping = lazy(() => import('./pages/Shopping'))
const Bills = lazy(() => import('./pages/Bills'))
const Budget = lazy(() => import('./pages/Budget'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Categories = lazy(() => import('./pages/Categories'))
const Members = lazy(() => import('./pages/Members'))
const Activity = lazy(() => import('./pages/Activity'))
const Account = lazy(() => import('./pages/Account'))
const Settings = lazy(() => import('./pages/Settings'))
const Tutorial = lazy(() => import('./pages/Tutorial'))
const Credits = lazy(() => import('./pages/Credits'))
const Updates = lazy(() => import('./pages/Updates'))
const Notifications = lazy(() => import('./pages/Notifications'))
const AdminUser = lazy(() => import('./pages/AdminUser'))
const AdminAppeals = lazy(() => import('./pages/AdminAppeals'))
const AdminAppeal = lazy(() => import('./pages/AdminAppeal'))
const Admin = lazy(() => import('./pages/Admin'))
const Feedback = lazy(() => import('./pages/Feedback'))
const AdminFeedback = lazy(() => import('./pages/AdminFeedback'))

const RouteFallback = () => (
  <div className="mx-auto max-w-5xl px-3 py-5 sm:px-4">
    <PageSkeleton />
  </div>
)

const App = () => {
  return (
    <BrowserRouter>
      {/* The opening animation plays over the app while it loads underneath. */}
      <IntroSplash />
      <AuthProvider>
        <SpaceProvider>
          <SyncProvider>
            <MoneyProvider>
              <ShoppingProvider>
                <BillsProvider>
                  <UpdateBanner />
                  <ConnectionStatus />

                  <Suspense fallback={<RouteFallback />}>
                    <Routes>
                      <Route element={<AuthLayout />}>
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/forgot-password" element={<ForgotPassword />} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                      </Route>
                      <Route path="/verify-email" element={<VerifyEmail />} />
                      <Route path="/terms" element={<Terms />} />
                      <Route path="/privacy" element={<Privacy />} />

                      <Route element={<ProtectedRoute />}>
                        <Route element={<AppLayout />}>
                          <Route path="/" element={<Home />} />
                          <Route path="/shopping" element={<Shopping />} />
                          <Route path="/bills" element={<Bills />} />
                          <Route path="/budget" element={<Budget />} />
                          <Route path="/analytics" element={<Analytics />} />
                          <Route path="/categories" element={<Categories />} />
                          <Route path="/members" element={<Members />} />
                          <Route path="/activity" element={<Activity />} />
                          <Route path="/account" element={<Account />} />
                          <Route path="/settings" element={<Settings />} />
                          <Route path="/tutorial" element={<Tutorial />} />
                          <Route path="/credits" element={<Credits />} />
                          <Route path="/updates" element={<Updates />} />
                          <Route path="/notifications" element={<Notifications />} />
                          <Route path="/feedback" element={<Feedback />} />
                          <Route path="/admin" element={<Admin />} />
                          <Route path="/admin/feedback" element={<AdminFeedback />} />
                          <Route path="/admin/users/:userId" element={<AdminUser />} />
                          <Route path="/admin/appeals" element={<AdminAppeals />} />
                          <Route path="/admin/appeals/:appealId" element={<AdminAppeal />} />
                        </Route>
                      </Route>

                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Suspense>
                </BillsProvider>
              </ShoppingProvider>
            </MoneyProvider>
          </SyncProvider>
        </SpaceProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
