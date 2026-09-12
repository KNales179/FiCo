import { transactionRepository } from '../../repositories'
import { listShoppingLists } from '../shopping'
import { listBills, listBillPayments } from '../bills'
import type { DateRange } from '../../domain/analytics'

/**
 * "Active points" (Roadmap: engagement, not just presence). A simple, honest
 * count of the things Fico actually knows who did — recording a transaction,
 * starting a shopping trip, adding a bill, paying one — each weighted a bit
 * by the effort it represents. There's no field tracking who checked off a
 * shopping item or completed someone else's list, so those aren't counted
 * here rather than guessed at.
 */

const POINTS = {
  transaction: 2,
  shoppingListStarted: 3,
  billAdded: 3,
  billPaid: 4,
} as const

export interface MemberEngagement {
  userId: string
  points: number
  transactionsRecorded: number
  shoppingListsStarted: number
  billsAdded: number
  billsPaid: number
}

const inRange = (iso: string, range: DateRange) =>
  iso >= range.fromIso && iso <= range.toIso

export const computeEngagement = async (
  spaceId: string,
  range: DateRange,
): Promise<MemberEngagement[]> => {
  const [transactions, lists, bills] = await Promise.all([
    transactionRepository.getAllByIndex('by-spaceId', spaceId),
    listShoppingLists(spaceId),
    listBills(spaceId),
  ])

  const payments = (
    await Promise.all(bills.map((b) => listBillPayments(b.id)))
  ).flat()

  const byUser = new Map<string, MemberEngagement>()
  const entry = (userId: string) => {
    let e = byUser.get(userId)
    if (!e) {
      e = {
        userId,
        points: 0,
        transactionsRecorded: 0,
        shoppingListsStarted: 0,
        billsAdded: 0,
        billsPaid: 0,
      }
      byUser.set(userId, e)
    }
    return e
  }

  for (const t of transactions) {
    if (!t.createdBy || !inRange(t.occurredAt, range)) continue
    const e = entry(t.createdBy)
    e.transactionsRecorded += 1
    e.points += POINTS.transaction
  }

  for (const l of lists) {
    if (!l.createdBy || !inRange(l.createdAt, range)) continue
    const e = entry(l.createdBy)
    e.shoppingListsStarted += 1
    e.points += POINTS.shoppingListStarted
  }

  for (const b of bills) {
    if (!b.createdBy || !inRange(b.createdAt, range)) continue
    const e = entry(b.createdBy)
    e.billsAdded += 1
    e.points += POINTS.billAdded
  }

  for (const p of payments) {
    if (!p.createdBy || !inRange(p.paidAt, range)) continue
    const e = entry(p.createdBy)
    e.billsPaid += 1
    e.points += POINTS.billPaid
  }

  return Array.from(byUser.values()).sort((a, b) => b.points - a.points)
}
