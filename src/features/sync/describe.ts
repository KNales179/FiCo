import { formatMoney } from '../../domain/money'
import type { SyncIssue } from './engine'

/** Plain-language descriptions of synced changes, for notifications. */

export const KIND_LABEL: Record<string, string> = {
  transaction: 'Record',
  account: 'Account',
  bill: 'Bill',
  billPayment: 'Bill payment',
  shoppingList: 'To-buy list',
  shoppingItem: 'To-buy item',
  category: 'Category',
  budgetPlan: 'Budget plan',
  reconciliation: 'Cash check',
  itemProfile: 'Saved item',
  priceHistory: 'Price record',
  electricityRecord: 'Usage reading',
}

const OPERATION_LABEL: Record<string, string> = {
  CREATE: 'Added',
  UPDATE: 'Edited',
  DELETE: 'Deleted',
  CHECK: 'Checked off',
  UNCHECK: 'Un-checked',
  PAY: 'Paid',
}

const TYPE_LABEL: Record<string, string> = { EXPENSE: 'Spent', INCOME: 'Received', TRANSFER: 'Transfer' }

export const FIELD_LABEL: Record<string, string> = {
  title: 'Title',
  name: 'Name',
  displayName: 'Name',
  amountMinor: 'Amount',
  plannedPriceMinor: 'Planned price',
  actualPriceMinor: 'Actual price',
  expectedAmountMinor: 'Expected amount',
  openingBalanceMinor: 'Opening balance',
  categoryName: 'Category',
  occurredAt: 'Date',
  paidAt: 'Date paid',
  nextDueDate: 'Due date',
  quantity: 'Quantity',
  checked: 'Checked off',
  status: 'Status',
  note: 'Note',
  details: 'Details',
  type: 'Type',
  visibility: 'Visible to',
  archived: 'Archived',
  expectedIncomeMinor: 'Expected income',
  accountId: 'Account',
  categoryId: 'Category',
  destinationAccountId: 'To account',
  destinationAmountMinor: 'Amount received',
  purchased: 'Bought',
  purchasedAt: 'Bought on',
  consumptionKwh: 'Usage',
  usageKind: 'Tracks',
  recurrence: 'Repeats',
  billType: 'Bill type',
  tracksElectricity: 'Tracks kWh',
  scheduledDates: 'Scheduled dates',
  active: 'Active',
  isDefault: 'Default',
  currency: 'Currency',
  exchangeRate: 'Exchange rate',
  plannedBudgetMinor: 'Planned budget',
  actualMinor: 'Actual',
  expectedMinor: 'Expected',
  differenceMinor: 'Difference',
  resolvedNote: 'Resolution note',
  billingPeriod: 'Billing period',
  taxesMinor: 'Taxes',
  energyChargeMinor: 'Energy charge',
  transmissionMinor: 'Transmission',
  distributionMinor: 'Distribution',
  otherChargesMinor: 'Other charges',
}

const asDate = (v: unknown) => {
  if (typeof v !== 'string') return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export const fieldValue = (field: string, v: unknown, currency?: string): string => {
  if (v === null || v === undefined || v === '') return '—'
  if (field.endsWith('Minor') && typeof v === 'number') return formatMoney(v, currency)
  if (field === 'occurredAt' || field === 'paidAt' || field === 'nextDueDate' || field === 'purchasedAt') return asDate(v) ?? String(v)
  if (field === 'type') return TYPE_LABEL[String(v)] ?? String(v)
  if (field === 'visibility') return v === 'PRIVATE' ? 'Only me' : 'Everyone in the Finance'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
}

const nameOf = (r: Record<string, unknown>, entityType: string) =>
  (r.title as string) ||
  (r.name as string) ||
  (r.displayName as string) ||
  (entityType === 'budgetPlan' && r.period ? `Budget for ${r.period as string}` : '') ||
  KIND_LABEL[entityType] ||
  entityType

export interface NotificationSection {
  heading: string
  lines: { label: string; value: string }[]
}

/** A change, as lines a person can read (and re-enter if they need to). */
const describeChange = (issue: SyncIssue, financeName: string | null): NotificationSection => {
  const r = issue.attempted
  const currency = (r.currency as string) || undefined
  const lines: NotificationSection['lines'] = [
    { label: 'What', value: `${KIND_LABEL[issue.entityType] ?? issue.entityType} · ${OPERATION_LABEL[issue.operation] ?? issue.operation}` },
  ]
  if (financeName) lines.push({ label: 'Finance', value: financeName })
  for (const field of ['type', 'amountMinor', 'categoryName', 'occurredAt', 'paidAt', 'quantity', 'note', 'details']) {
    if (r[field] !== undefined && r[field] !== null && r[field] !== '') {
      lines.push({ label: FIELD_LABEL[field], value: fieldValue(field, r[field], currency) })
    }
  }
  if (issue.reason) lines.push({ label: 'Why', value: issue.reason })
  return { heading: `“${nameOf(r, issue.entityType)}”`, lines }
}

const describeOverwrite = (issue: SyncIssue, financeName: string | null): NotificationSection => {
  const mine = issue.attempted
  const kept = issue.kept ?? {}
  const currency = (kept.currency as string) || (mine.currency as string) || undefined
  const fields = (issue.lostFields?.length ? issue.lostFields : Object.keys(FIELD_LABEL)).filter(
    (f) => FIELD_LABEL[f] && JSON.stringify(mine[f]) !== JSON.stringify(kept[f]),
  )
  const lines: NotificationSection['lines'] = []
  if (financeName) lines.push({ label: 'Finance', value: financeName })
  for (const f of fields) {
    lines.push({
      label: FIELD_LABEL[f],
      value: `yours: ${fieldValue(f, mine[f], currency)} → kept: ${fieldValue(f, kept[f], currency)}`,
    })
  }
  if (lines.length === (financeName ? 1 : 0)) lines.push({ label: 'Change', value: 'Your edit matched what was already saved.' })
  return { heading: `“${nameOf(kept.title || kept.name ? kept : mine, issue.entityType)}”`, lines }
}

export interface IssueNotice {
  kind: 'SYNC_REJECTED' | 'SYNC_OVERWRITTEN'
  title: string
  body: string
  sections: NotificationSection[]
}

/** One notification per kind, for everything that happened in a sync. */
export const noticesForIssues = (issues: SyncIssue[], financeNames: Record<string, string>): IssueNotice[] => {
  const out: IssueNotice[] = []
  const rejected = issues.filter((i) => i.kind === 'REJECTED')
  const overwritten = issues.filter((i) => i.kind === 'OVERWRITTEN')
  if (rejected.length) {
    out.push({
      kind: 'SYNC_REJECTED',
      title:
        rejected.length === 1
          ? `A change couldn’t be saved to the server`
          : `${rejected.length} changes couldn’t be saved to the server`,
      body:
        'They’re still on this device. Tap “Try again” on the sync status, or “Discard” to drop them — either way, the details stay here so nothing is lost and you can re-enter them if needed.',
      sections: rejected.map((i) => describeChange(i, financeNames[i.spaceId] ?? null)),
    })
  }
  if (overwritten.length) {
    out.push({
      kind: 'SYNC_OVERWRITTEN',
      title:
        overwritten.length === 1
          ? `Your offline edit to ${describeOverwrite(overwritten[0], null).heading} was replaced`
          : `${overwritten.length} of your offline edits were replaced`,
      body:
        'Someone changed the same thing more recently, so their version was kept. Here’s what you had, in case you want to change it back.',
      sections: overwritten.map((i) => describeOverwrite(i, financeNames[i.spaceId] ?? null)),
    })
  }
  return out
}
