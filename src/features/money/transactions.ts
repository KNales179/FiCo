import { accountRepository, transactionRepository } from '../../repositories'
import {
  validateTransactionInput,
  type TransactionInput,
} from '../../domain/transactions'
import type {
  Account,
  Transaction,
  TransactionSourceType,
} from '../../types/models'
import type { MoneyContext } from './context'
import { enqueueMutation } from './enqueue'

export interface RecordTransactionInput extends TransactionInput {
  details?: string
  occurredAt?: string
  /** Category name snapshot — stored as-is, never rewritten later (§10). */
  categoryName?: string | null
  /** Where this transaction came from — defaults to MANUAL. */
  sourceType?: TransactionSourceType
  sourceId?: string | null
}

export interface ListTransactionsOptions {
  limit?: number
  /** Only transactions strictly before this ISO timestamp (for paging). */
  before?: string
  accountId?: string
  type?: Transaction['type']
}

export const listTransactions = async (
  spaceId: string,
  options: ListTransactionsOptions = {},
): Promise<Transaction[]> => {
  let rows = await transactionRepository.getAllByIndex(
    'by-spaceId',
    spaceId,
  )

  if (options.type) {
    rows = rows.filter((txn) => txn.type === options.type)
  }
  if (options.accountId) {
    rows = rows.filter(
      (txn) =>
        txn.accountId === options.accountId ||
        txn.destinationAccountId === options.accountId,
    )
  }
  if (options.before) {
    rows = rows.filter((txn) => txn.occurredAt < options.before!)
  }

  rows.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  return options.limit ? rows.slice(0, options.limit) : rows
}

/**
 * Record a transaction locally (local-first, Architecture §57). Validates
 * against the space's accounts, writes to IndexedDB, and queues a sync event.
 */
export const recordTransaction = async (
  ctx: MoneyContext,
  input: RecordTransactionInput,
): Promise<Transaction> => {
  const accounts = await accountRepository.getAllByIndex(
    'by-spaceId',
    ctx.spaceId,
  )
  const accountsById = new Map<string, Account>(
    accounts.map((account) => [account.id, account]),
  )

  const error = validateTransactionInput(input, accountsById)
  if (error) {
    throw new Error(error)
  }

  const source = accountsById.get(input.accountId)!

  const txn = await transactionRepository.create({
    spaceId: ctx.spaceId,
    type: input.type,
    amountMinor: input.amountMinor,
    currency: source.currency,
    title: input.title.trim(),
    details: input.details?.trim() || undefined,
    categoryId: null,
    categoryName: input.categoryName ?? null,
    accountId: input.accountId,
    destinationAccountId:
      input.type === 'TRANSFER' ? input.destinationAccountId : null,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    sourceType: input.sourceType ?? 'MANUAL',
    sourceId: input.sourceId ?? null,
    createdBy: ctx.userId,
    syncStatus: 'PENDING',
    version: 1,
  })

  await enqueueMutation(ctx, 'transaction', txn.id, 'CREATE', txn)
  return txn
}

export const deleteTransaction = async (
  ctx: MoneyContext,
  id: string,
): Promise<void> => {
  await transactionRepository.softDelete(id)
  await enqueueMutation(ctx, 'transaction', id, 'DELETE', { id })
}
