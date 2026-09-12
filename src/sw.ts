/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope

// Same offline app-shell behavior the old generateSW config gave us —
// switching to a hand-written service worker (injectManifest) only to add
// push handling below, not to change any of this.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

self.skipWaiting()
self.addEventListener('activate', () => void self.clients.claim())

interface PushPayload {
  title: string
  body: string
  tag?: string
  url?: string
}

/**
 * Real push notifications (Roadmap: notifications, tier 2). The backend's
 * bill-reminder job is the only thing sending these today, but this handler
 * doesn't know or care what the notification is about — `url` just decides
 * where a click on it goes.
 */
self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload: PushPayload
  try {
    payload = event.data.json() as PushPayload
  } catch {
    return
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: payload.tag,
      data: { url: payload.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data as { url?: string } | undefined)?.url || '/'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus()
          }
        }
        return self.clients.openWindow(url)
      }),
  )
})
