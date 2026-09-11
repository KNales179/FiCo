import { describe, expect, it } from 'vitest'
import { balanceEffect, validateTransactionInput } from './transactions'
import { advanceDueDate, periodKey, retreatDueDate } from './bills'
import { resolveRange, summarize } from './analytics'
import { pickTripCategory } from './shopping'
import type { Account, Transaction } from '../types/models'

describe('balanceEffect', () => {
  const base = { amountMinor: 1000 }
  it('income/expense affect only their account', () => {
    expect(
      balanceEffect(
        { ...base, type: 'INCOME', accountId: 'a' },
        'a',
      ),
    ).toBe(1000)
    expect(
      balanceEffect(
        { ...base, type: 'EXPENSE', accountId: 'a' },
        'a',
      ),
    ).toBe(-1000)
    expect(
      balanceEffect(
        { ...base, type: 'EXPENSE', accountId: 'a' },
        'b',
      ),
    ).toBe(0)
  })
  it('transfer is −source, +destination', () => {
    const t = {
      ...base,
      type: 'TRANSFER' as const,
      accountId: 'a',
      destinationAccountId: 'b',
    }
    expect(balanceEffect(t, 'a')).toBe(-1000)
    expect(balanceEffect(t, 'b')).toBe(1000)
    expect(balanceEffect(t, 'c')).toBe(0)
  })
})

describe('validateTransactionInput', () => {
  const acc = (over: Partial<Account>): Account =>
    ({
      id: 'a',
      spaceId: 's',
      name: 'A',
      type: 'CASH',
      currency: 'PHP',
      openingBalanceMinor: 0,
      status: 'ACTIVE',
      isDefault: false,
      createdAt: '',
      updatedAt: '',
      syncStatus: 'PENDING',
      version: 1,
      ...over,
    }) as Account

  const accounts = new Map<string, Account>([
    ['a', acc({ id: 'a' })],
    ['b', acc({ id: 'b', currency: 'USD' })],
    ['x', acc({ id: 'x', status: 'ARCHIVED' })],
  ])

  it('accepts a well-formed expense', () => {
    expect(
      validateTransactionInput(
        { type: 'EXPENSE', amountMinor: 100, title: 'x', accountId: 'a' },
        accounts,
      ),
    ).toBeNull()
  })
  it('rejects zero amount, archived account, cross-currency transfer', () => {
    expect(
      validateTransactionInput(
        { type: 'EXPENSE', amountMinor: 0, title: 'x', accountId: 'a' },
        accounts,
      ),
    ).toBeTruthy()
    expect(
      validateTransactionInput(
        { type: 'EXPENSE', amountMinor: 10, title: 'x', accountId: 'x' },
        accounts,
      ),
    ).toBeTruthy()
    expect(
      validateTransactionInput(
        {
          type: 'TRANSFER',
          amountMinor: 10,
          title: 'x',
          accountId: 'a',
          destinationAccountId: 'b',
        },
        accounts,
      ),
    ).toBeTruthy()
  })
})

describe('bill recurrence', () => {
  it('advances monthly, clamping short months', () => {
    expect(
      advanceDueDate('2026-01-31T00:00:00.000Z', 'MONTHLY').slice(0, 10),
    ).toBe('2026-02-28')
    expect(
      advanceDueDate('2026-01-15T00:00:00.000Z', 'MONTHLY').slice(0, 10),
    ).toBe('2026-02-15')
  })
  it('advances yearly', () => {
    expect(
      advanceDueDate('2026-01-15T00:00:00.000Z', 'YEARLY').slice(0, 10),
    ).toBe('2027-01-15')
  })
  it('periodKey dedupes an occurrence', () => {
    expect(periodKey('2026-03-01T00:00:00.000Z', 'MONTHLY')).toBe('2026-03')
    expect(periodKey('2026-03-01T00:00:00.000Z', 'YEARLY')).toBe('2026')
  })
  it('retreatDueDate undoes advanceDueDate, one step back', () => {
    expect(
      retreatDueDate('2026-02-15T00:00:00.000Z', 'MONTHLY').slice(0, 10),
    ).toBe('2026-01-15')
    expect(
      retreatDueDate('2027-01-15T00:00:00.000Z', 'YEARLY').slice(0, 10),
    ).toBe('2026-01-15')
  })
})

describe('pickTripCategory', () => {
  it('picks the category most items share', () => {
    const r = pickTripCategory([
      { categoryId: 'g', categoryName: 'Groceries' },
      { categoryId: 'g', categoryName: 'Groceries' },
      { categoryId: 'h', categoryName: 'Household' },
    ])
    expect(r).toEqual({ categoryId: 'g', categoryName: 'Groceries' })
  })

  it('leaves a genuine tie uncategorized', () => {
    const r = pickTripCategory([
      { categoryId: 'g', categoryName: 'Groceries' },
      { categoryId: 'h', categoryName: 'Household' },
    ])
    expect(r).toEqual({ categoryId: null, categoryName: null })
  })

  it('leaves an all-uncategorized trip uncategorized', () => {
    expect(
      pickTripCategory([
        { categoryId: null, categoryName: null },
        { categoryId: null, categoryName: null },
      ]),
    ).toEqual({ categoryId: null, categoryName: null })
  })
})

describe('analytics summarize', () => {
  const t = (over: Partial<Transaction>): Transaction =>
    ({
      type: 'EXPENSE',
      amountMinor: 1000,
      currency: 'PHP',
      occurredAt: '2026-03-05T00:00:00.000Z',
      categoryName: null,
      sourceType: 'MANUAL',
      createdBy: 'u1',
      ...over,
    }) as Transaction

  it('excludes transfers from income and expense', () => {
    const s = summarize([
      t({ type: 'INCOME', amountMinor: 100000 }),
      t({ type: 'EXPENSE', amountMinor: 30000, categoryName: 'Food' }),
      t({
        type: 'EXPENSE',
        amountMinor: 20000,
        categoryName: 'Bills',
        sourceType: 'BILL_PAYMENT',
      }),
      t({ type: 'TRANSFER', amountMinor: 50000 }),
    ])
    expect(s.incomeMinor).toBe(100000)
    expect(s.expenseMinor).toBe(50000)
    expect(s.transferMinor).toBe(50000)
    expect(s.netMinor).toBe(50000)
    expect(s.billSpendMinor).toBe(20000)
    expect(s.byCategory[0]).toMatchObject({ name: 'Food', amountMinor: 30000 })
    expect(Math.round(s.expensePctOfIncome)).toBe(50)
  })

  it('ranks who spent more in a shared Finance, by whoever recorded the expense', () => {
    const s = summarize([
      t({ amountMinor: 30000, createdBy: 'u1' }),
      t({ amountMinor: 10000, createdBy: 'u2' }),
      t({ type: 'INCOME', amountMinor: 100000, createdBy: 'u1' }), // never counted
      t({ type: 'TRANSFER', amountMinor: 5000, createdBy: 'u1' }), // never counted
    ])
    expect(s.byMember).toEqual([
      { userId: 'u1', amountMinor: 30000, pct: 75 },
      { userId: 'u2', amountMinor: 10000, pct: 25 },
    ])
  })

  it('resolveRange this-year spans the calendar year', () => {
    const r = resolveRange(
      'THIS_YEAR',
      undefined,
      new Date('2026-06-15T00:00:00Z'),
    )
    expect(r.fromIso.slice(0, 10)).toBe('2026-01-01')
    expect(r.toIso.slice(0, 10)).toBe('2026-12-31')
  })
})
