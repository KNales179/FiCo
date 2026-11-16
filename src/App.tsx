import { Suspense } from 'react'
import { lazyPage } from './lib/lazyPage'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AuthProvider } from './context/AuthContext'
import { SpaceProvider } from './context/SpaceProvider'
import { SyncProvider } from './context/SyncProvider'
import { MoneyProvider } from './context/MoneyProvider'
import { ShoppingProvider } from './context/ShoppingProvider'
import { BillsProvider } from './context/BillsProvider'
import ProtectedRoute from './components/ProtectedRoute'
import GuestRoute from './components/GuestRoute'
import AppLayout from './components/AppLayout'
import ConnectionStatus from './components/ConnectionStatus'
import UpdateBanner from './components/UpdateBanner'
import IntroSplash from './components/IntroSplash'
import GridGlow from './components/GridGlow'
import CursorTag from './components/CursorTag'
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
const Shopping = lazyPage(() => import('./pages/Shopping'))
const Bills = lazyPage(() => import('./pages/Bills'))
const Budget = lazyPage(() => import('./pages/Budget'))
const Analytics = lazyPage(() => import('./pages/Analytics'))
const Calendar = lazyPage(() => import('./pages/Calendar'))
const Categories = lazyPage(() => import('./pages/Categories'))
const Members = lazyPage(() => import('./pages/Members'))
const Activity = lazyPage(() => import('./pages/Activity'))
const Account = lazyPage(() => import('./pages/Account'))
const Settings = lazyPage(() => import('./pages/Settings'))
const Tutorial = lazyPage(() => import('./pages/Tutorial'))
const Credits = lazyPage(() => import('./pages/Credits'))
const Updates = lazyPage(() => import('./pages/Updates'))
const Notifications = lazyPage(() => import('./pages/Notifications'))
const AdminUser = lazyPage(() => import('./pages/AdminUser'))
const AdminAppeals = lazyPage(() => import('./pages/AdminAppeals'))
const AdminAppeal = lazyPage(() => import('./pages/AdminAppeal'))
const Admin = lazyPage(() => import('./pages/Admin'))
const Welcome = lazyPage(() => import('./pages/Welcome'))
const AdminInvites = lazyPage(() => import('./pages/AdminInvites'))
const AdminLayout = lazyPage(() => import('./components/admin/AdminLayout'))
const Feedback = lazyPage(() => import('./pages/Feedback'))
const AdminFeedback = lazyPage(() => import('./pages/AdminFeedback'))

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
      {/* Grid lines near the mouse light up (front page, sign-in and the app). */}
      <GridGlow />
      {/* What a button does: follows the mouse; press and hold on touch. */}
      <CursorTag />
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
                        {/* Already signed in? These send you to your dashboard. */}
                        <Route element={<GuestRoute />}>
                          <Route path="/login" element={<Login />} />
                          <Route path="/register" element={<Register />} />
                        </Route>
                        <Route path="/forgot-password" element={<ForgotPassword />} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                      </Route>
                      <Route path="/verify-email" element={<VerifyEmail />} />
                      {/* The front page, on purpose (from the sign-in screen's logo). */}
                      <Route path="/welcome" element={<Welcome />} />
                      <Route path="/terms" element={<Terms />} />
                      <Route path="/privacy" element={<Privacy />} />

                      <Route element={<ProtectedRoute />}>
                        <Route element={<AppLayout />}>
                          <Route path="/" element={<Home />} />
                          <Route path="/shopping" element={<Shopping />} />
                          <Route path="/bills" element={<Bills />} />
                          <Route path="/budget" element={<Budget />} />
                          <Route path="/analytics" element={<Analytics />} />
                          <Route path="/calendar" element={<Calendar />} />
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
                          {/* Admin: one bar of sections over every admin page. */}
                          <Route element={<AdminLayout />}>
                            <Route path="/admin" element={<Admin />} />
                            <Route path="/admin/invites" element={<AdminInvites />} />
                            <Route path="/admin/feedback" element={<AdminFeedback />} />
                            <Route path="/admin/users/:userId" element={<AdminUser />} />
                            <Route path="/admin/appeals" element={<AdminAppeals />} />
                            <Route path="/admin/appeals/:appealId" element={<AdminAppeal />} />
                          </Route>
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
