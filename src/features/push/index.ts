import { getVapidPublicKey, subscribePush, unsubscribePush } from '../../services/pushService'

export const isPushSupported = (): boolean =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/** VAPID keys are URL-safe base64 — the browser API wants raw bytes. */
const urlBase64ToUint8Array = (base64: string): Uint8Array<ArrayBuffer> => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
  return bytes
}

export const getCurrentPushSubscription = async (): Promise<PushSubscription | null> => {
  if (!isPushSupported()) return null
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

export interface EnablePushResult {
  ok: boolean
  reason?: 'unsupported' | 'permission-denied' | 'not-configured'
}

/** Asks for permission (if needed), subscribes this device, and registers it with the server. */
export const enablePush = async (deviceId?: string): Promise<EnablePushResult> => {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' }

  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return { ok: false, reason: 'permission-denied' }
  }
  if (Notification.permission !== 'granted') {
    return { ok: false, reason: 'permission-denied' }
  }

  const { publicKey } = await getVapidPublicKey()
  if (!publicKey) return { ok: false, reason: 'not-configured' }

  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }))

  await subscribePush(subscription.toJSON() as PushSubscriptionJSON, deviceId)
  return { ok: true }
}

/** Unsubscribes this device, both on the server and in the browser. */
export const disablePush = async (): Promise<void> => {
  const subscription = await getCurrentPushSubscription()
  if (!subscription) return
  await unsubscribePush(subscription.endpoint).catch(() => {
    // Still unsubscribe locally even if the server call failed (offline, etc.)
  })
  await subscription.unsubscribe()
}
