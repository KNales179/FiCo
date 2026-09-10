import { accountRepository, transactionRepository } from '../../repositories'
import type { Account, AccountType } from '../../types/models'
import type { MoneyContext } from './context'
import { enqueueMutation } from './enqueue'

export interface NewAccountInput {
  name: string
  type: AccountType
  currency?: string
  openingBalanceMinor?: number
}

export const listAccounts = (spaceId: string): Promise<Account[]> =>
  accountRepository.getAllByIndex('by-spaceId', spaceId)

export const createAccount = async (
  ctx: MoneyContext,
  input: NewAccountInput & { isDefault?: boolean },
): Promise<Account> => {
  const existing = await accountRepository.getAllByIndex(
    'by-spaceId',
    ctx.spaceId,
  )

  // First account in the space, or one explicitly requested, becomes default.
  const makeDefault = input.isDefault === true || existing.length === 0

  if (makeDefault) {
    await Promise.all(
      existing
        .filter((a) => a.isDefault)
        .map((a) =>
          accountRepository.update(a.id, {
            isDefault: false,
            syncStatus: 'PENDING',
          }),
        ),
    )
  }

  const account = await accountRepository.create({
    spaceId: ctx.spaceId,
    name: input.name.trim(),
    type: input.type,
    currency: (input.currency ?? 'PHP').toUpperCase(),
    openingBalanceMinor: input.openingBalanceMinor ?? 0,
    status: 'ACTIVE',
    isDefault: makeDefault,
    syncStatus: 'PENDING',
    version: 1,
  })

  await enqueueMutation(ctx, 'account', account.id, 'CREATE', account)
  return account
}

export const setDefaultAccount = async (
  ctx: MoneyContext,
  id: string,
): Promise<void> => {
  const accounts = await accountRepository.getAllByIndex(
    'by-spaceId',
    ctx.spaceId,
  )

  for (const account of accounts) {
    const shouldBeDefault = account.id === id
    if (account.isDefault !== shouldBeDefault) {
      const updated = await accountRepository.update(account.id, {
        isDefault: shouldBeDefault,
        syncStatus: 'PENDING',
      })
      await enqueueMutation(
        ctx,
        'account',
        account.id,
        'UPDATE',
        updated,
      )
    }
  }
}

/** The account Quick Add should use: the marked default, else a CASH account, else the first. */
export const resolveDefaultAccount = <T extends Account>(
  accounts: T[],
): T | undefined => {
  const active = accounts.filter((a) => a.status === 'ACTIVE')
  return (
    active.find((a) => a.isDefault) ??
    active.find((a) => a.type === 'CASH') ??
    active[0]
  )
}

export const renameAccount = async (
  ctx: MoneyContext,
  id: string,
  name: string,
): Promise<Account> => {
  const account = await accountRepository.update(id, {
    name: name.trim(),
    syncStatus: 'PENDING',
  })
  await enqueueMutation(ctx, 'account', id, 'UPDATE', account)
  return account
}

export const setAccountStatus = async (
  ctx: MoneyContext,
  id: string,
  status: 'ACTIVE' | 'ARCHIVED',
): Promise<Account> => {
  const account = await accountRepository.update(id, {
    status,
    syncStatus: 'PENDING',
  })
  await enqueueMutation(ctx, 'account', id, 'UPDATE', account)
  return account
}

/**
 * Soft-delete an account. Refused while it still has transactions so history
 * and balances stay coherent — archive it instead.
 */
export const deleteAccount = async (
  ctx: MoneyContext,
  id: string,
): Promise<void> => {
  const spaceTxns = await transactionRepository.getAllByIndex(
    'by-spaceId',
    ctx.spaceId,
  )
  const referenced = spaceTxns.some(
    (txn) => txn.accountId === id || txn.destinationAccountId === id,
  )
  if (referenced) {
    throw new Error(
      'This account still has transactions. Archive it instead of deleting.',
    )
  }

  await accountRepository.softDelete(id)
  await enqueueMutation(ctx, 'account', id, 'DELETE', { id })
}
