import { describe, expect, it } from 'vitest'
import {
  newBlankItem,
  parseItemQuantity,
  rowTotalMinor,
  sumItemPricesMinor,
  toScannedReceiptItems,
  type DraftItem,
} from './draftItems'

const row = (over: Partial<DraftItem>): DraftItem => ({
  id: 0,
  name: '',
  quantity: '1',
  price: '',
  categoryId: '',
  ...over,
})

describe('parseItemQuantity', () => {
  it('parses a plain integer', () => {
    expect(parseItemQuantity('3')).toBe(3)
  })

  it('defaults a blank or unparseable quantity to 1, never 0', () => {
    expect(parseItemQuantity('')).toBe(1)
    expect(parseItemQuantity('not-a-number')).toBe(1)
    expect(parseItemQuantity('0')).toBe(1)
    expect(parseItemQuantity('-2')).toBe(1)
  })
})

describe('rowTotalMinor', () => {
  it('multiplies price-per-unit by quantity', () => {
    expect(rowTotalMinor(row({ price: '50.00', quantity: '3' }))).toBe(15000)
  })

  it('is null when the price is blank, regardless of quantity', () => {
    expect(rowTotalMinor(row({ price: '', quantity: '3' }))).toBeNull()
  })
})

describe('sumItemPricesMinor', () => {
  it('sums each row as price × quantity, ignoring blanks', () => {
    const total = sumItemPricesMinor([
      row({ price: '80.25', quantity: '1' }),
      row({ price: '' }),
      // 3 units at ₱45 each — the bug report this fixes: the list total
      // must reflect the quantity, not just the typed price.
      row({ price: '45.00', quantity: '3' }),
    ])
    expect(total).toBe(8025 + 45 * 3 * 100)
  })

  it('is zero for an empty list', () => {
    expect(sumItemPricesMinor([])).toBe(0)
  })
})

describe('newBlankItem', () => {
  it('assigns an id one past the last row', () => {
    expect(newBlankItem([row({ id: 4 }), row({ id: 7 })]).id).toBe(8)
  })

  it('starts at 0 for an empty list', () => {
    expect(newBlankItem([]).id).toBe(0)
  })
})

describe('toScannedReceiptItems', () => {
  it('drops unnamed rows, multiplies price by quantity, and resolves the category name', () => {
    const names = new Map([['cat-1', 'Groceries']])
    const out = toScannedReceiptItems(
      [
        row({ name: 'Milk', quantity: '2', price: '90.00', categoryId: 'cat-1' }),
        row({ name: '  ', price: '10.00' }),
        row({ name: 'Soap', quantity: 'not-a-number', price: '' }),
      ],
      names,
    )
    expect(out).toEqual([
      // 2 units at ₱90 each -> ₱180 recorded, not ₱90.
      { name: 'Milk', quantity: 2, priceMinor: 18000, categoryId: 'cat-1', categoryName: 'Groceries' },
      { name: 'Soap', quantity: 1, priceMinor: null, categoryId: null, categoryName: null },
    ])
  })
})
