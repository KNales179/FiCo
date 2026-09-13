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
  categoryId?: string | null
  /** Category name snapshot — stored as-is, never rewritten later (§10). */
  categoryName?: string | null
  /** SPACE (shared) or PRIVATE (creator only). Defaults to SPACE. */
  visibility?: 'SPACE' | 'PRIVATE'
  /** Where this transaction came from — defaults to MANUAL. */
  sourceType?: TransactionSourceType
  sourceId?: string | null
  /** The rate used to compute `destinationAmountMinor` (source→destination), kept for transparency. */
  exchangeRate?: number | null
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
  // Hot path (the dashboard "recent" list): a bounded reverse cursor over
  // `by-space-occurredAt` instead of reading the whole history (Phase 26).
  if (options.limit) {
    return transactionRepository.listRecent(spaceId, {
      limit: options.limit,
      before: options.before,
      type: options.type,
      accountId: options.accountId,
    })
  }

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

  // Newest first by when it happened; ties (same `occurredAt`, e.g. two
  // transactions dated but not timed the same day) break by `createdAt` —
  // the order they were actually entered in — instead of whatever
  // arbitrary order the store happens to return, which could otherwise
  // look like it reshuffled for no reason.
  rows.sort(
    (a, b) =>
      b.occurredAt.localeCompare(a.occurredAt) ||
      b.createdAt.localeCompare(a.createdAt),
  )
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
    categoryId: input.categoryId ?? null,
    categoryName: input.categoryName ?? null,
    accountId: input.accountId,
    destinationAccountId:
      input.type === 'TRANSFER' ? input.destinationAccountId : null,
    destinationAmountMinor:
      input.type === 'TRANSFER' ? input.destinationAmountMinor ?? null : null,
    exchangeRate:
      input.type === 'TRANSFER' ? input.exchangeRate ?? null : null,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    sourceType: input.sourceType ?? 'MANUAL',
    sourceId: input.sourceId ?? null,
    visibility: input.visibility ?? 'SPACE',
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

export interface UpdateTransactionInput {
  title?: string
  amountMinor?: number
  accountId?: string
  destinationAccountId?: string | null
  destinationAmountMinor?: number | null
  categoryId?: string | null
  categoryName?: string | null
  occurredAt?: string
}

/**
 * Corrects a mistake on a transaction that's already been recorded — the
 * wrong account, a typo in the name, the wrong amount, or the wrong
 * category. This is a different thing from the §10 rule ("a category
 * name is a snapshot, never rewritten") — that rule is about *automatic*
 * cascades (renaming a category, changing an item's default category)
 * never silently reaching back into old records; a person directly fixing
 * a specific mistake on their own transaction is the normal, expected way
 * to correct it.
 *
 * The transaction's `type` (income/expense/transfer) is deliberately not
 * editable here — that changes what the record fundamentally means, not
 * just a detail of it; delete and re-add instead.
 */
export const updateTransaction = async (
  ctx: MoneyContext,
  id: string,
  patch: UpdateTransactionInput,
): Promise<Transaction> => {
  const existing = await transactionRepository.get(id)
  if (!existing || existing.deletedAt) {
    throw new Error('Transaction not found')
  }

  const accounts = await accountRepository.getAllByIndex(
    'by-spaceId',
    ctx.spaceId,
  )
  const accountsById = new Map<string, Account>(
    accounts.map((account) => [account.id, account]),
  )

  const merged: TransactionInput = {
    type: existing.type,
    amountMinor: patch.amountMinor ?? existing.amountMinor,
    title: patch.title ?? existing.title,
    accountId: patch.accountId ?? existing.accountId,
    destinationAccountId:
      patch.destinationAccountId !== undefined
        ? patch.destinationAccountId
        : existing.destinationAccountId,
    // Falls back to whatever was already recorded so re-saving a
    // cross-currency transfer without touching its accounts doesn't trip
    // the "needs a destination amount" check below.
    destinationAmountMinor:
      patch.destinationAmountMinor !== undefined
        ? patch.destinationAmountMinor
        : existing.destinationAmountMinor,
  }

  const error = validateTransactionInput(merged, accountsById)
  if (error) throw new Error(error)

  const next = await transactionRepository.update(id, {
    ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
    ...(patch.amountMinor !== undefined
      ? { amountMinor: patch.amountMinor }
      : {}),
    ...(patch.accountId !== undefined ? { accountId: patch.accountId } : {}),
    ...(patch.destinationAccountId !== undefined
      ? { destinationAccountId: patch.destinationAccountId }
      : {}),
    ...(patch.destinationAmountMinor !== undefined
      ? { destinationAmountMinor: patch.destinationAmountMinor }
      : {}),
    ...(patch.categoryId !== undefined ? { categoryId: patch.categoryId } : {}),
    ...(patch.categoryName !== undefined
      ? { categoryName: patch.categoryName }
      : {}),
    ...(patch.occurredAt !== undefined ? { occurredAt: patch.occurredAt } : {}),
    syncStatus: 'PENDING',
  })
  await enqueueMutation(ctx, 'transaction', id, 'UPDATE', next)
  return next
}

export const setTransactionVisibility = async (
  ctx: MoneyContext,
  id: string,
  visibility: 'SPACE' | 'PRIVATE',
): Promise<void> => {
  const txn = await transactionRepository.update(id, {
    visibility,
    syncStatus: 'PENDING',
  })
  await enqueueMutation(ctx, 'transaction', id, 'UPDATE', txn)
}
