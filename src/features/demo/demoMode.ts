import type { User } from '../../types/auth'

/**
 * Demo mode — "Try the demo" on the sign-in screen. A pretend account that
 * lives only on this device: no server, no real sign-in. It opens on the
 * same sample Finance the guided tours use, everything in it can be
 * changed freely, and leaving the demo wipes all of it.
 *
 * While it's on, `api()` refuses every request as if offline, so nothing
 * is ever sent to the real server and the app runs on local data — the
 * same way it already works with no connection.
 */

const FLAG_KEY = 'fico.demoMode'
const USER_KEY = 'fico.demoUser'

export const DEMO_USER_ID = 'fico-demo-user'

export const isDemoMode = (): boolean => {
  try {
    return localStorage.getItem(FLAG_KEY) === '1'
  } catch {
    return false
  }
}

const defaultDemoUser = (): User => {
  // Birthday early next month, so the Budget page's birthday tip shows up.
  const next = new Date()
  next.setMonth(next.getMonth() + 1, 12)
  return {
    id: DEMO_USER_ID,
    username: 'demo_juan',
    email: 'demo@fico.local',
    displayName: 'Juan (demo)',
    birthday: { month: next.getMonth() + 1, day: 12, year: 1996 },
    paydays: [15, 31],
    role: 'USER',
    totpEnabled: false,
    emailVerified: true,
    avatarUrl: '/avatars/cool-cat.webp',
  }
}

export const loadDemoUser = (): User => {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (raw) return JSON.parse(raw) as User
  } catch {
    // fall through
  }
  return defaultDemoUser()
}

/** Profile edits in the demo just change the copy on this device. */
export const saveDemoUser = (patch: Partial<User>): User => {
  const next = { ...loadDemoUser(), ...patch, id: DEMO_USER_ID }
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
  return next
}

export const enterDemoMode = (): User => {
  try {
    localStorage.setItem(FLAG_KEY, '1')
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem('fico.demoMembers')
  } catch {
    // ignore
  }
  return saveDemoUser({})
}

export const leaveDemoMode = () => {
  try {
    localStorage.removeItem(FLAG_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem('fico.demoMembers')
  } catch {
    // ignore
  }
}
