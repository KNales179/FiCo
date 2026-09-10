import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'

import { AuthProvider } from './context/AuthContext'
import { SpaceProvider } from './context/SpaceProvider'
import { MoneyProvider } from './context/MoneyProvider'
import { ShoppingProvider } from './context/ShoppingProvider'
import { BillsProvider } from './context/BillsProvider'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'
import ConnectionStatus from './components/ConnectionStatus'

import Login from './pages/Login'
import Register from './pages/Register'
import Home from './pages/Home'
import Shopping from './pages/Shopping'
import Bills from './pages/Bills'
import Analytics from './pages/Analytics'

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SpaceProvider>
          <MoneyProvider>
            <ShoppingProvider>
              <BillsProvider>
                <ConnectionStatus />

                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />

                  <Route element={<ProtectedRoute />}>
                    <Route element={<AppLayout />}>
                      <Route path="/" element={<Home />} />
                      <Route path="/shopping" element={<Shopping />} />
                      <Route path="/bills" element={<Bills />} />
                      <Route path="/analytics" element={<Analytics />} />
                    </Route>
                  </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </BillsProvider>
            </ShoppingProvider>
          </MoneyProvider>
        </SpaceProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
