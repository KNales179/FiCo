import type { ActionLogEntry } from '../../services/actionLogService'
import { DEMO_USER_ID } from './demoMode'

/**
 * The demo's Activity history. The real one comes from the server, which
 * the demo never contacts, so the demo household gets a made-up history of
 * its own: records added, bills paid, edits with before and after, role
 * changes, and one sync conflict — enough to fill every Activity tab.
 */
const PEOPLE: Record<string, string> = {
  [DEMO_USER_ID]: 'Juan (demo)',
  'demo-maria': 'Maria',
  'demo-paolo': 'Paolo',
  'demo-lola': 'Lola Nena',
}

const RAW: Array<Omit<ActionLogEntry, 'id' | 'actorName' | 'createdAt'> & { minutesAgo: number }> = [
  { minutesAgo: 25, actorId: 'demo-maria', action: 'CREATE', entityType: 'transaction', entityId: 'd1', summary: 'added transaction "Jollibee"' },
  { minutesAgo: 70, actorId: DEMO_USER_ID, action: 'UPDATE', entityType: 'transaction', entityId: 'd2', summary: 'updated transaction "Groceries"', changes: [{ field: 'amountMinor', from: 150000, to: 172550 }] },
  { minutesAgo: 140, actorId: 'demo-paolo', action: 'CHECK', entityType: 'shoppingItem', entityId: 'd3', summary: 'checked "Rice 5kg"' },
  { minutesAgo: 141, actorId: 'demo-paolo', action: 'CHECK', entityType: 'shoppingItem', entityId: 'd4', summary: 'checked "Eggs (1 tray)"' },
  { minutesAgo: 200, actorId: DEMO_USER_ID, action: 'PAY', entityType: 'billPayment', entityId: 'd5', summary: 'paid "Electricity (Meralco)"' },
  { minutesAgo: 60 * 26, actorId: 'demo-maria', action: 'UPDATE', entityType: 'bill', entityId: 'd6', summary: 'updated bill "Water (Maynilad)"', changes: [{ field: 'expectedAmountMinor', from: 45000, to: 48000 }, { field: 'note', from: null, to: 'Price went up in October' }] },
  { minutesAgo: 60 * 27, actorId: 'demo-paolo', action: 'CREATE', entityType: 'shoppingList', entityId: 'd7', summary: 'added shoppingList "Weekly groceries"' },
  { minutesAgo: 60 * 30, actorId: DEMO_USER_ID, action: 'DELETE', entityType: 'transaction', entityId: 'd8', summary: 'removed transaction "Duplicate taxi fare"' },
  { minutesAgo: 60 * 50, actorId: DEMO_USER_ID, action: 'CONFLICT', entityType: 'transaction', entityId: 'd2', summary: 'kept a newer change to amountMinor on transaction', changes: [{ field: 'amountMinor', from: 160000, to: 150000 }] },
  { minutesAgo: 60 * 72, actorId: DEMO_USER_ID, action: 'ROLE_CHANGE', entityType: 'membership', entityId: 'demo-maria', summary: 'made Maria an admin' },
  { minutesAgo: 60 * 73, actorId: DEMO_USER_ID, action: 'ROLE_CHANGE', entityType: 'membership', entityId: 'demo-lola', summary: 'made Lola Nena a viewer' },
  { minutesAgo: 60 * 74, actorId: DEMO_USER_ID, action: 'MEMBER_ADD', entityType: 'membership', entityId: 'demo-paolo', summary: 'added Paolo to the Finance' },
]

const MEMBER = ['MEMBER_ADD', 'MEMBER_REMOVE', 'ROLE_CHANGE', 'OWNERSHIP_TRANSFER', 'INVITE']
const KINDS: Record<string, string[]> = {
  money: ['transaction', 'account', 'reconciliation'],
  bills: ['bill', 'billPayment', 'electricityRecord'],
  tobuy: ['shoppingList', 'shoppingItem', 'itemProfile', 'priceHistory'],
  planning: ['budgetPlan', 'category'],
}

/** The same filters as the real Activity endpoint: a tab, and for Records a kind. */
export const demoActionLogs = (options: { group?: string; kind?: string }): ActionLogEntry[] => {
  const now = Date.now()
  return RAW.filter((e) => {
    if (options.group === 'members') return MEMBER.includes(e.action)
    if (options.group === 'conflicts') return e.action === 'CONFLICT'
    if (options.group === 'records') {
      if (MEMBER.includes(e.action) || e.action === 'CONFLICT') return false
      return !options.kind || (KINDS[options.kind] ?? []).includes(e.entityType)
    }
    return true
  }).map(({ minutesAgo, ...e }, i) => ({
    ...e,
    id: `demo-log-${i}-${e.entityId}`,
    actorName: PEOPLE[e.actorId] ?? 'Someone',
    createdAt: new Date(now - minutesAgo * 60_000).toISOString(),
  }))
}
