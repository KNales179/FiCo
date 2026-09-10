import type { Account, Transaction, TransactionType } from '../types/models'
import { isValidMinor } from './money'

/**
 * Pure financial rules for transactions. These mirror the server-side checks in
 * `backend/src/controllers/transactionController.ts` (Architecture §49) so the
 * local-first UI can validate and compute balances without a round trip.
 */

export const isExpense = (txn: Pick<Transaction, 'type'>): boolean =>
  txn.type === 'EXPENSE'

/**
 * How a transaction changes one account's balance.
 *
 *   INCOME    → +amount on its account
 *   EXPENSE   → −amount on its account
 *   TRANSFER  → −amount on the source, +amount on the destination
 *
 * A TRANSFER is never an expense and never changes the space total (Rule 4).
 */
export const balanceEffect = (
  txn: Pick<
    Transaction,
    'type' | 'amountMinor' | 'accountId' | 'destinationAccountId'
  >,
  accountId: string,
): number => {
  if (txn.accountId === accountId) {
    return txn.type === 'INCOME' ? txn.amountMinor : -txn.amountMinor
  }
  if (txn.type === 'TRANSFER' && txn.destinationAccountId === accountId) {
    return txn.amountMinor
  }
  return 0
}

export interface TransactionInput {
  type: TransactionType
  amountMinor: number
  title: string
  accountId: string
  destinationAccountId?: string | null
}

/**
 * Validates a transaction against the given accounts. Returns an error message,
 * or null when the input is sound.
 */
export const validateTransactionInput = (
  input: TransactionInput,
  accountsById: Map<string, Account>,
): string | null => {
  if (!isValidMinor(input.amountMinor) || input.amountMinor <= 0) {
    return 'Enter an amount greater than zero'
  }

  if (!input.title.trim()) {
    return 'Add a short title'
  }

  const source = accountsById.get(input.accountId)
  if (!source) return 'Choose an account'
  if (source.status !== 'ACTIVE') return 'That account is archived'

  if (input.type !== 'TRANSFER') {
    if (input.destinationAccountId) {
      return 'Only transfers have a destination account'
    }
    return null
  }

  if (!input.destinationAccountId) {
    return 'Choose an account to transfer into'
  }
  if (input.destinationAccountId === input.accountId) {
    return 'A transfer needs two different accounts'
  }

  const destination = accountsById.get(input.destinationAccountId)
  if (!destination) return 'Choose an account to transfer into'
  if (destination.status !== 'ACTIVE') {
    return 'The destination account is archived'
  }
  if (destination.currency !== source.currency) {
    return 'Both accounts must use the same currency'
  }

  return null
}
