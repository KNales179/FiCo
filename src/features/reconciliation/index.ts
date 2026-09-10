import { reconciliationRepository } from '../../repositories'
import { computeSpaceBalances } from '../money'
import { enqueueMutation } from '../sync/enqueue'
import type { MutationContext } from '../sync/context'
import type { Reconciliation } from '../../types/models'

export const listReconciliations = (
  spaceId: string,
): Promise<Reconciliation[]> =>
  reconciliationRepository.listBySpace(spaceId)

export const openReconciliationFor = (
  accountId: string,
): Promise<Reconciliation | undefined> =>
  reconciliationRepository.openForAccount(accountId)

/**
 * Record a cash check (Architecture §33, Roadmap Phase 14): snapshot the
 * account's derived balance as "expected", store the counted "actual", keep
 * the difference visible. Never creates a transaction to paper over a gap.
 */
export const recordCashCheck = async (
  ctx: MutationContext,
  input: { accountId: string; actualMinor: number; note?: string | null },
): Promise<Reconciliation> => {
  const balances = await computeSpaceBalances(ctx.spaceId)
  const account = balances.accounts.find(
    (a) => a.id === input.accountId,
  )
  if (!account) {
    throw new Error('Account not found')
  }

  const expectedMinor = account.balanceMinor

  const reconciliation = await reconciliationRepository.create({
    spaceId: ctx.spaceId,
    accountId: input.accountId,
    expectedMinor,
    actualMinor: input.actualMinor,
    differenceMinor: input.actualMinor - expectedMinor,
    note: input.note ?? null,
    status: 'OPEN',
    resolvedNote: null,
    resolvedAt: null,
    createdBy: ctx.userId,
    syncStatus: 'PENDING',
    version: 1,
  })
  await enqueueMutation(
    ctx,
    'reconciliation',
    reconciliation.id,
    'CREATE',
    reconciliation,
  )
  return reconciliation
}

export const resolveCashCheck = async (
  ctx: MutationContext,
  id: string,
  resolvedNote: string | null,
): Promise<Reconciliation> => {
  const reconciliation = await reconciliationRepository.update(id, {
    status: 'RESOLVED',
    resolvedNote,
    resolvedAt: new Date().toISOString(),
    syncStatus: 'PENDING',
  })
  await enqueueMutation(
    ctx,
    'reconciliation',
    id,
    'UPDATE',
    reconciliation,
  )
  return reconciliation
}
