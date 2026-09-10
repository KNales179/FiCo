import { useAuth } from '../hooks/useAuth'
import SyncStatus from '../components/SyncStatus'

const Home = () => {
  const { user, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
  }

  return (
    <main className="min-h-screen p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Welcome to Fico</h1>
          <p className="mt-2">Hello, {user?.username}</p>
        </div>

        <SyncStatus />
      </div>

      <button
        onClick={handleLogout}
        className="mt-6 border px-4 py-2"
      >
        Logout
      </button>
    </main>
  )
}

export default Home
