import { useOnlineStatus } from '../hooks/useOnlineStatus'

/**
 * A thin banner shown only while the device is offline, making it obvious that
 * Fico is still usable and that changes are being kept locally.
 */
const ConnectionStatus = () => {
  const online = useOnlineStatus()

  if (online) {
    return null
  }

  return (
    <div
      role="status"
      className="w-full bg-amber-500 px-4 py-1.5 text-center text-sm font-medium text-white"
    >
      Offline — changes are saved on this device and will sync later
    </div>
  )
}

export default ConnectionStatus
