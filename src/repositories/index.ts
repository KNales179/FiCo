/**
 * Repository layer — the only place the app reads or writes local data.
 *
 * UI and application code depend on these, never on `idb` or `getDB()`
 * directly, so the local-first storage can evolve behind a stable surface
 * (Architecture §56).
 */
export { createRepository } from './createRepository'
export type {
  QueryOptions,
  NewRecordInput,
  Repository,
  RepoStoreName,
} from './createRepository'

export {
  userRepository,
  spaceRepository,
  membershipRepository,
} from './identity'
export { accountRepository, transactionRepository } from './money'
export {
  shoppingListRepository,
  shoppingItemRepository,
  itemProfileRepository,
  priceHistoryRepository,
} from './shopping'
export {
  billRepository,
  billPaymentRepository,
  electricityRecordRepository,
} from './bills'
export { attachmentRepository } from './attachments'
export { sessionRepository } from './sessionRepository'
export { syncEventRepository } from './syncEventRepository'
export type { NewSyncEvent } from './syncEventRepository'
export { metadataRepository, MetadataKeys } from './metadataRepository'

import {
  userRepository,
  spaceRepository,
  membershipRepository,
} from './identity'
import { accountRepository, transactionRepository } from './money'
import {
  shoppingListRepository,
  shoppingItemRepository,
  itemProfileRepository,
  priceHistoryRepository,
} from './shopping'
import {
  billRepository,
  billPaymentRepository,
  electricityRecordRepository,
} from './bills'
import { attachmentRepository } from './attachments'
import { sessionRepository } from './sessionRepository'
import { syncEventRepository } from './syncEventRepository'
import { metadataRepository } from './metadataRepository'

/** All repositories, keyed by domain name — handy for tooling and debugging. */
export const repositories = {
  users: userRepository,
  spaces: spaceRepository,
  memberships: membershipRepository,
  accounts: accountRepository,
  transactions: transactionRepository,
  shoppingLists: shoppingListRepository,
  shoppingItems: shoppingItemRepository,
  itemProfiles: itemProfileRepository,
  priceHistory: priceHistoryRepository,
  bills: billRepository,
  billPayments: billPaymentRepository,
  electricityRecords: electricityRecordRepository,
  attachments: attachmentRepository,
  sessions: sessionRepository,
  syncEvents: syncEventRepository,
  metadata: metadataRepository,
} as const
