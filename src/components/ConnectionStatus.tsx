import { useConnectivity } from '../hooks/useConnectivity'
import { isDemoMode } from '../features/demo/demoMode'

/**
 * A thin banner shown only when Fico can't reach its server, making it
 * obvious that the app is still usable and that changes are kept locally.
 *
 * It tells three situations apart, because they call for different reactions:
 * genuinely offline; online but the server is still waking up (a free-tier
 * host can take up to a minute — nothing is wrong, the app is retrying on its
 * own); and online but the server has stayed silent long enough that it's
 * probably really down.
 */
const ConnectionStatus = () => {
  const { serverState } = useConnectivity()

  if (serverState === 'checking' || serverState === 'reachable') return null
  // The demo never uses the server, so its state isn't news there.
  if (isDemoMode()) return null

  const waking = serverState === 'waking'

  return (
    <div
      role="status"
      className={`w-full px-4 py-1.5 text-center text-sm font-medium text-white ${
        waking ? 'bg-sky-600' : 'bg-amber-500'
      }`}
    >
      {serverState === 'offline' &&
        'Offline — changes are saved on this device and will sync later'}
      {waking &&
        "You're online — waking up the Fico server. Keep using the app; changes are saved and will sync on their own"}
      {serverState === 'unreachable' &&
        "Can't reach the Fico server — still trying. Changes are saved on this device and will sync when it's back"}
    </div>
  )
}

export default ConnectionStatus
