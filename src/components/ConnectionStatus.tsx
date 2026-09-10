import { useConnectivity } from '../hooks/useConnectivity'

/**
 * A thin banner shown only when Fico genuinely can't reach its server, making
 * it obvious that the app is still usable and that changes are kept locally.
 * It distinguishes "no network" from "server not answering" so a running app
 * with a working connection never gets mislabelled as offline.
 */
const ConnectionStatus = () => {
  const { navigatorOnline, serverReachable } = useConnectivity()

  // Still checking, or the server answered — nothing to show.
  if (serverReachable === null || serverReachable) return null

  return (
    <div
      role="status"
      className="w-full bg-amber-500 px-4 py-1.5 text-center text-sm font-medium text-white"
    >
      {navigatorOnline
        ? "Can't reach the Fico server — changes are saved on this device and will sync when it's back"
        : 'Offline — changes are saved on this device and will sync later'}
    </div>
  )
}

export default ConnectionStatus
