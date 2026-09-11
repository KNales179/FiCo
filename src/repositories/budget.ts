import type { BudgetPlan } from '../types/models'
import { createRepository } from './createRepository'

const base = createRepository('budgetPlans')

export const budgetPlanRepository = {
  ...base,

  listBySpace(spaceId: string): Promise<BudgetPlan[]> {
    return base.getAllByIndex('by-spaceId', spaceId)
  },

  getByPeriod(
    spaceId: string,
    period: string,
  ): Promise<BudgetPlan | undefined> {
    return base.getByIndex('by-space-period', [spaceId, period])
  },
}
