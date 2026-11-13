import { describe, expect, it } from 'vitest'
import { noticesForIssues } from './describe'
import type { SyncIssue } from './engine'

const rejected: SyncIssue = {
  kind: 'REJECTED',
  spaceId: 's1',
  entityType: 'transaction',
  entityId: 't1',
  operation: 'CREATE',
  attempted: { title: 'Groceries', amountMinor: 50000, currency: 'PHP', type: 'EXPENSE', occurredAt: '2026-11-13T02:00:00.000Z' },
  reason: 'amount must be > 0',
}

const overwritten: SyncIssue = {
  kind: 'OVERWRITTEN',
  spaceId: 's1',
  entityType: 'transaction',
  entityId: 't2',
  operation: 'UPDATE',
  attempted: { title: 'Lunch', amountMinor: 35000, currency: 'PHP' },
  kept: { title: 'Lunch', amountMinor: 40000, currency: 'PHP' },
  lostFields: ['amountMinor'],
}

describe('sync issue notices', () => {
  it('lists every rejected change with what it was, where, and why', () => {
    const [notice] = noticesForIssues([rejected], { s1: 'Family' })
    expect(notice.kind).toBe('SYNC_REJECTED')
    expect(notice.title).toMatch(/couldn’t be saved/)
    const section = notice.sections[0]
    expect(section.heading).toBe('“Groceries”')
    const lines = Object.fromEntries(section.lines.map((l) => [l.label, l.value]))
    expect(lines.Finance).toBe('Family')
    expect(lines.Type).toBe('Spent')
    expect(lines.Amount).toMatch(/500/)
    expect(lines.Why).toBe('amount must be > 0')
  })

  it('shows yours vs kept for an overwritten edit', () => {
    const [notice] = noticesForIssues([overwritten], { s1: 'Family' })
    expect(notice.kind).toBe('SYNC_OVERWRITTEN')
    expect(notice.title).toContain('Lunch')
    const amount = notice.sections[0].lines.find((l) => l.label === 'Amount')!
    expect(amount.value).toMatch(/yours: .*350.* kept: .*400/)
  })

  it('groups a round into one notice per kind', () => {
    const notices = noticesForIssues([rejected, { ...rejected, entityId: 't3' }, overwritten], {})
    expect(notices.map((n) => n.kind)).toEqual(['SYNC_REJECTED', 'SYNC_OVERWRITTEN'])
    expect(notices[0].sections).toHaveLength(2)
    expect(notices[0].title).toMatch(/^2 changes/)
  })
})
