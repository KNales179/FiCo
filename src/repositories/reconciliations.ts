import type { Reconciliation } from '../types/models'
import { createRepository } from './createRepository'

const base = createRepository('reconciliations')

export const reconciliationRepository = {
  ...base,

  async listBySpace(spaceId: string): Promise<Reconciliation[]> {
    const rows = await base.getAllByIndex('by-spaceId', spaceId)
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  async listByAccount(accountId: string): Promise<Reconciliation[]> {
    const rows = await base.getAllByIndex('by-accountId', accountId)
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  /** Most recent unresolved check for an account, if any. */
  async openForAccount(
    accountId: string,
  ): Promise<Reconciliation | undefined> {
    const rows = await this.listByAccount(accountId)
    return rows.find((r) => r.status === 'OPEN')
  },
}
