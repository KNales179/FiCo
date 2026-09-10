import { accountRepository, transactionRepository } from '../../repositories'
import { balanceEffect } from '../../domain/transactions'
import type { Account, Transaction } from '../../types/models'

export interface AccountWithBalance extends Account {
  balanceMinor: number
}

export interface SpaceBalances {
  accounts: AccountWithBalance[]
  totalsByCurrency: Record<string, number>
}

/**
 * Current balance of every active account in a space, derived locally from
 * opening balances + non-deleted transactions. Same rule as the server's
 * `computeBalances`, run against IndexedDB for instant, offline results.
 */
export const computeSpaceBalances = async (
  spaceId: string,
): Promise<SpaceBalances> => {
  const [accounts, transactions] = await Promise.all([
    accountRepository.getAllByIndex('by-spaceId', spaceId),
    transactionRepository.getAllByIndex('by-spaceId', spaceId),
  ])

  const withBalance = accounts.map((account: Account) => ({
    ...account,
    balanceMinor: account.openingBalanceMinor,
  }))

  const byId = new Map(withBalance.map((a) => [a.id, a]))

  for (const txn of transactions as Transaction[]) {
    const source = byId.get(txn.accountId)
    if (source) source.balanceMinor += balanceEffect(txn, source.id)

    if (txn.type === 'TRANSFER' && txn.destinationAccountId) {
      const dest = byId.get(txn.destinationAccountId)
      if (dest) dest.balanceMinor += balanceEffect(txn, dest.id)
    }
  }

  const totalsByCurrency: Record<string, number> = {}
  for (const account of withBalance) {
    totalsByCurrency[account.currency] =
      (totalsByCurrency[account.currency] ?? 0) + account.balanceMinor
  }

  return { accounts: withBalance, totalsByCurrency }
}
