import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'

import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import ConnectionStatus from './components/ConnectionStatus'

import Login from './pages/Login'
import Register from './pages/Register'
import Home from './pages/Home'

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ConnectionStatus />

        <Routes>
          <Route
            path="/login"
            element={<Login />}
          />

          <Route
            path="/register"
            element={<Register />}
          />

          <Route element={<ProtectedRoute />}>
            <Route
              path="/"
              element={<Home />}
            />
          </Route>

          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App