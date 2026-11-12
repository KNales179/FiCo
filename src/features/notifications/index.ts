import { useEffect, useSyncExternalStore } from 'react'
import { api, isNetworkError } from '../../lib/api'

export type NotificationKind = 'FEEDBACK_DONE' | 'ADMIN_NOTICE' | 'ADMIN_ACTION'

export interface AppNotification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  link: string | null
  senderName: string | null
  popup: boolean
  readAt: string | null
  createdAt: string
}

interface State {
  items: AppNotification[]
  unread: number
  loaded: boolean
}

const CACHE_KEY = 'fico.notifications'
const POLL_MS = 3 * 60 * 1000

const readCache = (): State => {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      const items = JSON.parse(raw) as AppNotification[]
      return { items, unread: items.filter((n) => !n.readAt).length, loaded: false }
    }
  } catch {
    // ignore
  }
  return { items: [], unread: 0, loaded: false }
}

let state: State = readCache()
const listeners = new Set<() => void>()

const set = (next: Partial<State>) => {
  state = { ...state, ...next }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(state.items))
  } catch {
    // ignore
  }
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Fetch the latest from the server; offline keeps the cached list. */
export const refreshNotifications = async (): Promise<void> => {
  try {
    const res = await api<{ notifications: AppNotification[]; unread: number }>('/notifications')
    set({ items: res.notifications, unread: res.unread, loaded: true })
  } catch (error) {
    if (!isNetworkError(error)) set({ loaded: true })
  }
}

/** Mark some (or all) read — updated here at once, then confirmed by the server. */
export const markNotificationsRead = async (ids: string[] | 'all'): Promise<void> => {
  const now = new Date().toISOString()
  const items = state.items.map((n) => (!n.readAt && (ids === 'all' || ids.includes(n.id)) ? { ...n, readAt: now } : n))
  set({ items, unread: items.filter((n) => !n.readAt).length })
  try {
    await api('/notifications/read', { method: 'POST', body: ids === 'all' ? { all: true } : { ids } })
  } catch {
    // Offline: it's read here; the server catches up next time it's marked or listed.
  }
}

export const clearNotificationCache = () => {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    // ignore
  }
  state = { items: [], unread: 0, loaded: false }
  listeners.forEach((l) => l())
}

export const useNotifications = (): State => useSyncExternalStore(subscribe, () => state, () => state)

/** Mounted once in the app shell: loads now, then every few minutes and whenever the app comes back to the foreground. */
export const useNotificationPolling = (enabled: boolean) => {
  useEffect(() => {
    if (!enabled) return
    void refreshNotifications()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshNotifications()
    }, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshNotifications()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [enabled])
}

/** A couple of sample notifications for the demo account, so the page isn't empty. */
export const seedDemoNotifications = () => {
  const now = Date.now()
  set({
    loaded: true,
    unread: 1,
    items: [
      {
        id: 'demo-n1',
        kind: 'ADMIN_NOTICE',
        title: 'Welcome to the Fico demo!',
        body: 'Everything here is sample data on your device. Add, edit and delete freely: nothing is saved to a server, and it all disappears when you exit the demo.',
        link: null,
        senderName: 'Fico Admin Team',
        popup: false,
        readAt: null,
        createdAt: new Date(now - 5 * 60_000).toISOString(),
      },
      {
        id: 'demo-n2',
        kind: 'FEEDBACK_DONE',
        title: 'Your suggestion made it into Fico!',
        body: '"Let us mark bills as paid from the list" — the Fico team marked your suggestion as done. Thank you! Go check Updates to see what is new.',
        link: '/updates',
        senderName: 'Fico Admin Team',
        popup: false,
        readAt: new Date(now - 86_400_000).toISOString(),
        createdAt: new Date(now - 2 * 86_400_000).toISOString(),
      },
    ],
  })
}
