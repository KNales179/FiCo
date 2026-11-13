import { useEffect, useSyncExternalStore } from 'react'
import { api, isNetworkError } from '../../lib/api'

export type NotificationKind =
  | 'FEEDBACK_DONE'
  | 'ADMIN_NOTICE'
  | 'ADMIN_ACTION'
  // Made on this device by the sync (never on the server):
  | 'SYNC_REJECTED'
  | 'SYNC_OVERWRITTEN'

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
  /** Detail blocks (e.g. each change that couldn't sync, line by line). */
  sections?: { heading: string; lines: { label: string; value: string }[] }[]
  /** Lives only on this device. */
  local?: boolean
}

interface State {
  items: AppNotification[]
  unread: number
  loaded: boolean
}

const CACHE_KEY = 'fico.notifications'
const LOCAL_KEY = 'fico.localNotifications'

const readLocal = (): AppNotification[] => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]') as AppNotification[]
  } catch {
    return []
  }
}
let localItems: AppNotification[] = readLocal()
const writeLocal = () => {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(localItems.slice(0, 100)))
  } catch {
    // ignore
  }
}

/** Server items + this device's own, newest first. */
const combine = (serverItems: AppNotification[]) =>
  [...serverItems.filter((n) => !n.local), ...localItems].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
const POLL_MS = 3 * 60 * 1000

const readCache = (): State => {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    const items = combine(raw ? (JSON.parse(raw) as AppNotification[]) : [])
    return { items, unread: items.filter((n) => !n.readAt).length, loaded: false }
  } catch {
    // ignore
  }
  return { items: [], unread: 0, loaded: false }
}

let state: State = readCache()
const listeners = new Set<() => void>()

const set = (next: Partial<State>) => {
  const items = next.items ? combine(next.items) : state.items
  state = { ...state, ...next, items, unread: items.filter((n) => !n.readAt).length }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(items.filter((n) => !n.local)))
  } catch {
    // ignore
  }
  listeners.forEach((l) => l())
}

/** Add notifications made on this device (e.g. a change the server refused). */
export const addLocalNotifications = (
  list: Pick<AppNotification, 'kind' | 'title' | 'body' | 'sections'>[],
): void => {
  if (list.length === 0) return
  const now = new Date().toISOString()
  localItems = [
    ...list.map((n, i) => ({
      ...n,
      id: `local-${Date.now()}-${i}`,
      link: null,
      senderName: 'Fico',
      popup: true,
      readAt: null,
      createdAt: now,
      local: true,
    })),
    ...localItems,
  ]
  writeLocal()
  set({ items: state.items })
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Fetch the latest from the server; offline keeps the cached list. */
export const refreshNotifications = async (): Promise<void> => {
  try {
    const res = await api<{ notifications: AppNotification[]; unread: number }>('/notifications')
    set({ items: res.notifications, loaded: true })
  } catch (error) {
    if (!isNetworkError(error)) set({ loaded: true })
  }
}

/** Mark some (or all) read — updated here at once, then confirmed by the server. */
export const markNotificationsRead = async (ids: string[] | 'all'): Promise<void> => {
  const now = new Date().toISOString()
  const hit = (n: AppNotification) => !n.readAt && (ids === 'all' || ids.includes(n.id))
  localItems = localItems.map((n) => (hit(n) ? { ...n, readAt: now } : n))
  writeLocal()
  const items = state.items.map((n) => (hit(n) ? { ...n, readAt: now } : n))
  set({ items })
  const serverIds = ids === 'all' ? 'all' : ids.filter((id) => !id.startsWith('local-'))
  if (serverIds !== 'all' && serverIds.length === 0) return
  try {
    await api('/notifications/read', { method: 'POST', body: serverIds === 'all' ? { all: true } : { ids: serverIds } })
  } catch {
    // Offline: it's read here; the server catches up next time it's marked or listed.
  }
}

export const clearNotificationCache = () => {
  try {
    localStorage.removeItem(CACHE_KEY)
    localStorage.removeItem(LOCAL_KEY)
  } catch {
    // ignore
  }
  localItems = []
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
