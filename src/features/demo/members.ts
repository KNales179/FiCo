import type { SpaceMember } from '../../types/space'
import { DEMO_USER_ID } from './demoMode'

/**
 * The demo Finance's pretend household, one of each role, so the Members
 * page shows what roles look like. Role changes stick on this device until
 * the demo ends — nothing is sent anywhere.
 */
const KEY = 'fico.demoMembers'

const defaults = (): SpaceMember[] => [
  { userId: DEMO_USER_ID, username: 'demo_juan', displayName: 'Juan (demo)', role: 'OWNER', avatarUrl: '/avatars/cool-cat.webp' },
  { userId: 'demo-maria', username: 'demo_maria', displayName: 'Maria', role: 'ADMIN', avatarUrl: '/avatars/glasses-doll.webp' },
  { userId: 'demo-paolo', username: 'demo_paolo', displayName: 'Paolo', role: 'MEMBER', avatarUrl: '/avatars/cap-puppy.webp' },
  { userId: 'demo-lola', username: 'demo_lola', displayName: 'Lola Nena', role: 'VIEWER', avatarUrl: '/avatars/gamer-cat.webp' },
]

export const loadDemoMembers = (): SpaceMember[] => {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as SpaceMember[]
  } catch {
    // fall through
  }
  return defaults()
}

export const setDemoMemberRole = (userId: string, role: SpaceMember['role']): SpaceMember[] => {
  const next = loadDemoMembers().map((m) => (m.userId === userId ? { ...m, role } : m))
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
  return next
}
