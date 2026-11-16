import { describe, expect, it } from 'vitest'
import { dayLabel, describeChange, friendlySummary } from './format'

const ctx = {
  currency: 'PHP',
  accounts: new Map([['acc-1', 'Cash on hand']]),
  categories: new Map([['cat-1', 'Food']]),
}

describe('activity wording', () => {
  it('uses everyday words, but never inside a quoted name', () => {
    expect(friendlySummary('added transaction "Lunch"')).toBe('added record "Lunch"')
    expect(friendlySummary('removed shoppingList "transaction day"')).toBe('removed to-buy list "transaction day"')
    expect(friendlySummary('kept a newer change to amountMinor, title on transaction')).toBe(
      'kept a newer change to amount, title on record',
    )
  })

  it('shows money, names and blanks plainly', () => {
    expect(describeChange({ field: 'amountMinor', from: 12000, to: 15000 }, ctx)).toEqual({
      label: 'Amount',
      from: expect.stringContaining('120'),
      to: expect.stringContaining('150'),
    })
    expect(describeChange({ field: 'accountId', from: 'acc-1', to: 'gone' }, ctx)).toEqual({
      label: 'Account',
      from: 'Cash on hand',
      to: 'a removed account',
    })
    expect(describeChange({ field: 'note', from: null, to: 'for Mama' }, ctx)?.from).toBe('—')
  })

  it('hides internal ids nobody needs', () => {
    expect(describeChange({ field: 'billId', from: 'a', to: 'b' }, ctx)).toBeNull()
  })

  it('labels days', () => {
    const now = new Date(2026, 10, 16, 15, 0)
    expect(dayLabel(new Date(2026, 10, 16, 9, 0).toISOString(), now)).toBe('Today')
    expect(dayLabel(new Date(2026, 10, 15, 23, 0).toISOString(), now)).toBe('Yesterday')
  })
})
