import {
  accountRepository,
  billPaymentRepository,
  billRepository,
  budgetPlanRepository,
  categoryRepository,
  electricityRecordRepository,
  itemProfileRepository,
  metadataRepository,
  priceHistoryRepository,
  reconciliationRepository,
  shoppingItemRepository,
  shoppingListRepository,
  syncEventRepository,
  transactionRepository,
} from '../../repositories'
import { initDB } from '../../db'
import { normalizeCategoryName } from '../categories'
import type {
  Account,
  Bill,
  BillPayment,
  Category,
  ElectricityRecord,
  ShoppingItem,
  ShoppingList,
  Transaction,
} from '../../types/models'
import { DEMO_SPACE_ID } from './space'

/**
 * Sample records for the guided tours, so someone brand new sees what each
 * part of Fico looks like with real-ish numbers in it instead of a wall of
 * empty states. Everything is written straight into IndexedDB under
 * DEMO_SPACE_ID (never through the feature functions, so nothing is queued
 * for sync), dated relative to today so "this month", "upcoming" and the
 * budget's history all have something to show — and removed by
 * `purgeDemoData` when the tour ends.
 */

const S = DEMO_SPACE_ID
const SEEDED_KEY = 'demo.seeded'

/** Start-up cleanup — only does real work if a tour was cut short. */
export const purgeDemoDataIfLeftOver = async (): Promise<void> => {
  await initDB()
  if ((await metadataRepository.get<boolean>(SEEDED_KEY)) === true) {
    await purgeDemoData()
  }
}

const daysAgo = (n: number, hour = 10) => {
  const d = new Date()
  d.setUTCHours(hour, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString()
}
const daysAhead = (n: number) => daysAgo(-n, 0)

/** Tiny deterministic random, so the sample looks the same every time. */
const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

const catId = (name: string) =>
  `default-${S}-${normalizeCategoryName(name).replace(/\s+/g, '-')}`

export const seedDemoData = async (userId: string): Promise<void> => {
  await initDB()
  await purgeDemoData()
  await metadataRepository.set(SEEDED_KEY, true)

  const now = new Date().toISOString()
  const base = {
    createdAt: daysAgo(80),
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'SYNCED' as const,
    version: 1,
  }

  // --- categories (same ids ensureDefaultCategories would use, so it skips them)
  const categoryDefs: Array<[string, 'EXPENSE' | 'INCOME', boolean]> = [
    ['Food', 'EXPENSE', false],
    ['Groceries', 'EXPENSE', true],
    ['Transportation', 'EXPENSE', false],
    ['Bills', 'EXPENSE', false],
    ['Health', 'EXPENSE', false],
    ['Shopping', 'EXPENSE', true],
    ['Entertainment', 'EXPENSE', false],
    ['Education', 'EXPENSE', false],
    ['Other', 'EXPENSE', false],
    ['Salary', 'INCOME', false],
    ['Other income', 'INCOME', false],
  ]
  const categories: Category[] = categoryDefs.map(([name, kind, tracksItems]) => ({
    ...base,
    id: catId(name),
    spaceId: S,
    name,
    normalizedName: normalizeCategoryName(name),
    kind,
    archived: false,
    tracksItems,
    createdBy: userId,
  }))
  await categoryRepository.bulkPut(categories)

  // --- accounts (opening balances are explicit transactions below, so the
  // MoneyProvider backfill has nothing to do)
  const account = (id: string, name: string, type: Account['type'], isDefault = false): Account => ({
    ...base,
    id,
    spaceId: S,
    name,
    type,
    currency: 'PHP',
    openingBalanceMinor: 0,
    status: 'ACTIVE',
    isDefault,
    createdBy: userId,
  })
  await accountRepository.bulkPut([
    account('demo-cash', 'Cash on hand', 'CASH', true),
    account('demo-bank', 'BDO Savings', 'BANK'),
    account('demo-gcash', 'GCash', 'EWALLET'),
  ])

  // --- transactions
  const txns: Transaction[] = []
  let n = 0
  const tx = (
    type: Transaction['type'],
    title: string,
    amountMinor: number,
    occurredAt: string,
    accountId: string,
    category: string | null,
    extra: Partial<Transaction> = {},
  ) => {
    txns.push({
      ...base,
      createdAt: occurredAt,
      id: `demo-tx-${++n}`,
      spaceId: S,
      type,
      amountMinor,
      currency: 'PHP',
      title,
      accountId,
      categoryId: category ? catId(category) : null,
      categoryName: category,
      occurredAt,
      sourceType: 'MANUAL',
      visibility: 'SPACE',
      createdBy: userId,
      ...extra,
    })
  }

  tx('INCOME', 'Starting balance', 500000, daysAgo(80, 8), 'demo-cash', null, { sourceType: 'OPENING_BALANCE', sourceId: 'demo-cash' })
  tx('INCOME', 'Starting balance', 2500000, daysAgo(80, 8), 'demo-bank', null, { sourceType: 'OPENING_BALANCE', sourceId: 'demo-bank' })
  tx('INCOME', 'Starting balance', 300000, daysAgo(80, 8), 'demo-gcash', null, { sourceType: 'OPENING_BALANCE', sourceId: 'demo-gcash' })

  const rand = rng(42)
  const foods = ['Jollibee', 'Carinderia lunch', 'Merienda', 'Milk tea', 'Bakery', 'Kwek-kwek', 'Mang Inasal']
  const rides = ['Jeep fare', 'Tricycle', 'Grab', 'MRT']
  for (let d = 75; d >= 0; d--) {
    const date = new Date(daysAgo(d))
    const day = date.getUTCDate()
    // Payday on the 15th and the 30th.
    if (day === 15 || day === 30) {
      tx('INCOME', 'Salary', 1800000, daysAgo(d, 9), 'demo-bank', 'Salary')
      tx('TRANSFER', 'ATM withdrawal', 500000, daysAgo(d, 11), 'demo-bank', null, { destinationAccountId: 'demo-cash' })
      tx('TRANSFER', 'Cash in to GCash', 600000, daysAgo(d, 11), 'demo-bank', null, { destinationAccountId: 'demo-gcash' })
    }
    if (rand() < 0.8) {
      tx('EXPENSE', foods[Math.floor(rand() * foods.length)], Math.round(80 + rand() * 260) * 100, daysAgo(d, 12), 'demo-cash', 'Food')
    }
    if (rand() < 0.6) {
      tx('EXPENSE', rides[Math.floor(rand() * rides.length)], Math.round(13 + rand() * 120) * 100, daysAgo(d, 8), 'demo-cash', 'Transportation')
    }
    if (date.getUTCDay() === 6) {
      // Recorded from a finished shopping list, like a real completed trip.
      tx('EXPENSE', 'Weekly groceries', Math.round(1800 + rand() * 900) * 100, daysAgo(d, 15), 'demo-gcash', 'Groceries', {
        sourceType: 'SHOPPING_LIST',
        sourceId: 'demo-list-last',
      })
    }
    if (rand() < 0.07) {
      tx('EXPENSE', 'Movie night', Math.round(350 + rand() * 300) * 100, daysAgo(d, 19), 'demo-gcash', 'Entertainment')
    }
    if (rand() < 0.05) {
      tx('EXPENSE', 'Pharmacy', Math.round(150 + rand() * 500) * 100, daysAgo(d, 17), 'demo-cash', 'Health')
    }
    if (d === 20) tx('EXPENSE', 'School project supplies', 85000, daysAgo(d, 16), 'demo-cash', 'Education')
    if (d === 9) tx('EXPENSE', 'New rubber shoes', 249900, daysAgo(d, 14), 'demo-gcash', 'Shopping')
    if (d === 3) tx('INCOME', 'Sold old phone', 350000, daysAgo(d, 18), 'demo-gcash', 'Other income')
  }

  // --- bills, with three months of payment history
  const bill = (id: string, name: string, extra: Partial<Bill>): Bill => ({
    ...base,
    id,
    spaceId: S,
    name,
    recurrence: 'MONTHLY',
    billType: 'FIXED',
    expectedAmountMinor: null,
    nextDueDate: null,
    scheduledDates: null,
    categoryId: catId('Bills'),
    categoryName: 'Bills',
    paymentAccountId: 'demo-bank',
    active: true,
    visibility: 'SPACE',
    createdBy: userId,
    tracksElectricity: false,
    ...extra,
  })
  const bills: Bill[] = [
    bill('demo-bill-electric', 'Electricity (Meralco)', {
      billType: 'VARIABLE',
      expectedAmountMinor: 260000,
      nextDueDate: daysAhead(4),
      tracksElectricity: true,
    }),
    bill('demo-bill-internet', 'Internet (PLDT Fiber)', {
      expectedAmountMinor: 169900,
      nextDueDate: daysAhead(11),
    }),
    bill('demo-bill-water', 'Water (Maynilad)', {
      billType: 'VARIABLE',
      expectedAmountMinor: 48000,
      nextDueDate: daysAhead(19),
    }),
    bill('demo-bill-lpg', 'LPG refill', {
      recurrence: 'NONE',
      expectedAmountMinor: 98000,
      paymentAccountId: 'demo-cash',
    }),
  ]
  await billRepository.bulkPut(bills)

  const payments: BillPayment[] = []
  const electricity: ElectricityRecord[] = []
  const kwh = [182, 205, 231]
  const electricAmounts = [231500, 259800, 287400]
  const waterAmounts = [41200, 46800, 45100]
  for (let m = 3; m >= 1; m--) {
    const paid = new Date()
    paid.setUTCDate(1)
    paid.setUTCMonth(paid.getUTCMonth() - m)
    paid.setUTCDate(Math.min(new Date().getUTCDate() + 3, 26))
    const paidAt = paid.toISOString()
    const key = paidAt.slice(0, 7)
    const i = 3 - m
    const pay = (billId: string, name: string, amountMinor: number) => {
      const txId = `demo-tx-${++n}`
      txns.push({
        ...base,
        createdAt: paidAt,
        id: txId,
        spaceId: S,
        type: 'EXPENSE',
        amountMinor,
        currency: 'PHP',
        title: name,
        accountId: 'demo-bank',
        categoryId: catId('Bills'),
        categoryName: 'Bills',
        occurredAt: paidAt,
        sourceType: 'BILL_PAYMENT',
        sourceId: billId,
        visibility: 'SPACE',
        createdBy: userId,
      })
      const payment: BillPayment = {
        ...base,
        createdAt: paidAt,
        id: `demo-pay-${billId}-${key}`,
        spaceId: S,
        billId,
        amountMinor,
        paidAt,
        periodKey: key,
        accountId: 'demo-bank',
        transactionId: txId,
        createdBy: userId,
      }
      payments.push(payment)
      return payment
    }
    const e = pay('demo-bill-electric', 'Electricity (Meralco)', electricAmounts[i])
    electricity.push({
      ...base,
      id: `demo-elec-${key}`,
      spaceId: S,
      billId: 'demo-bill-electric',
      billPaymentId: e.id,
      billingPeriod: key,
      amountMinor: electricAmounts[i],
      consumptionKwh: kwh[i],
    })
    pay('demo-bill-internet', 'Internet (PLDT Fiber)', 169900)
    pay('demo-bill-water', 'Water (Maynilad)', waterAmounts[i])
  }
  await billPaymentRepository.bulkPut(payments)
  await electricityRecordRepository.bulkPut(electricity)
  await transactionRepository.bulkPut(txns)

  // --- shopping: one trip in progress, one finished last week
  const list = (id: string, title: string, extra: Partial<ShoppingList>): ShoppingList => ({
    ...base,
    id,
    spaceId: S,
    title,
    status: 'ACTIVE',
    plannedBudgetMinor: null,
    plannedAt: null,
    completedAt: null,
    visibility: 'SPACE',
    createdBy: userId,
    ...extra,
  })
  await shoppingListRepository.bulkPut([
    list('demo-list-weekly', 'Weekly groceries', { plannedBudgetMinor: 250000, createdAt: daysAgo(1) }),
    list('demo-list-last', 'Puregold run', {
      status: 'COMPLETED',
      completedAt: daysAgo(6),
      plannedBudgetMinor: 200000,
      createdAt: daysAgo(7),
    }),
  ])
  const item = (
    listId: string,
    name: string,
    planned: number,
    actual: number | null,
    checked: boolean,
    i: number,
  ): ShoppingItem => ({
    ...base,
    id: `demo-item-${listId}-${i}`,
    spaceId: S,
    shoppingListId: listId,
    itemProfileId: null,
    name,
    plannedPriceMinor: planned,
    actualPriceMinor: actual,
    quantity: 1,
    checked,
    purchased: checked && actual != null,
    addedDuringTrip: false,
    transactionId: null,
    createdBy: userId,
  })
  await shoppingItemRepository.bulkPut([
    item('demo-list-weekly', 'Rice 5kg', 32000, 31500, true, 1),
    item('demo-list-weekly', 'Eggs (1 tray)', 24000, 25500, true, 2),
    item('demo-list-weekly', 'Chicken 1kg', 22000, null, false, 3),
    item('demo-list-weekly', 'Cooking oil', 12000, null, false, 4),
    item('demo-list-weekly', 'Dish soap', 6500, null, false, 5),
    item('demo-list-last', 'Coffee 3-in-1', 18000, 17500, true, 1),
    item('demo-list-last', 'Canned tuna x6', 21000, 22800, true, 2),
    item('demo-list-last', 'Bread', 9000, 9500, true, 3),
  ])
}

/** Removes every sample record — called when a tour ends and on start-up. */
export const purgeDemoData = async (): Promise<void> => {
  await initDB()
  const inDemo = <T extends { spaceId?: string; id: string }>(rows: T[]) =>
    rows.filter((r) => r.spaceId === S).map((r) => r.id)
  const all = { includeDeleted: true }

  const profiles = inDemo(await itemProfileRepository.getAll(all))
  const history = (await priceHistoryRepository.getAll(all)).filter((h) =>
    profiles.includes(h.itemProfileId),
  )
  for (const h of history) await priceHistoryRepository.hardDelete(h.id)

  const repos = [
    transactionRepository,
    accountRepository,
    categoryRepository,
    billRepository,
    billPaymentRepository,
    electricityRecordRepository,
    shoppingItemRepository,
    shoppingListRepository,
    itemProfileRepository,
    budgetPlanRepository,
    reconciliationRepository,
  ] as const
  for (const repo of repos) {
    const ids = inDemo(await (repo.getAll as (o: typeof all) => Promise<Array<{ id: string; spaceId?: string }>>)(all))
    for (const id of ids) await (repo.hardDelete as (id: string) => Promise<void>)(id)
  }

  // Belt and braces: enqueueMutation already refuses the sample space.
  for (const status of ['PENDING', 'FAILED', 'SYNCING', 'SYNCED'] as const) {
    const events = await syncEventRepository.listByStatus(status)
    for (const e of events) if (e.spaceId === S) await syncEventRepository.remove(e.id)
  }
  await metadataRepository.remove(SEEDED_KEY)
}
