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

import Login from './pages/Login'
import Register from './pages/Register'
import Home from './pages/Home'
// TEMPORARY — remove this import and its route once real password reset ships.
import DevResetPassword from './pages/DevResetPassword'

// Secondary routes are split out of the initial bundle (Roadmap Phase 26).
const Shopping = lazy(() => import('./pages/Shopping'))
const Bills = lazy(() => import('./pages/Bills'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Categories = lazy(() => import('./pages/Categories'))
const Members = lazy(() => import('./pages/Members'))
const Activity = lazy(() => import('./pages/Activity'))

const RouteFallback = () => (
  <p className="muted mx-auto max-w-4xl px-4 py-5">Loading…</p>
)

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SpaceProvider>
          <SyncProvider>
            <MoneyProvider>
              <ShoppingProvider>
                <BillsProvider>
                  <ConnectionStatus />

                  <Suspense fallback={<RouteFallback />}>
                    <Routes>
                      <Route path="/login" element={<Login />} />
                      <Route path="/register" element={<Register />} />
                      {/* TEMPORARY — remove alongside DevResetPassword.tsx. */}
                      <Route
                        path="/dev-reset-password"
                        element={<DevResetPassword />}
                      />

                      <Route element={<ProtectedRoute />}>
                        <Route element={<AppLayout />}>
                          <Route path="/" element={<Home />} />
                          <Route path="/shopping" element={<Shopping />} />
                          <Route path="/bills" element={<Bills />} />
                          <Route path="/analytics" element={<Analytics />} />
                          <Route path="/categories" element={<Categories />} />
                          <Route path="/members" element={<Members />} />
                          <Route path="/activity" element={<Activity />} />
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
