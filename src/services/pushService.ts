import { api } from '../lib/api'

export const getVapidPublicKey = () =>
  api<{ success: boolean; publicKey: string | null }>('/push/vapid-public-key')

export const subscribePush = (
  subscription: PushSubscriptionJSON,
  deviceId?: string,
) =>
  api<{ success: boolean; message: string }>('/push/subscribe', {
    method: 'POST',
    body: { ...subscription, deviceId },
  })

export const unsubscribePush = (endpoint: string) =>
  api<{ success: boolean; message: string }>('/push/unsubscribe', {
    method: 'POST',
    body: { endpoint },
  })
