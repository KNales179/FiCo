import { describe, expect, it } from 'vitest'
import {
  newBlankItem,
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

describe('sumItemPricesMinor', () => {
  it('sums parseable prices and ignores blanks', () => {
    const total = sumItemPricesMinor([
      row({ price: '80.25' }),
      row({ price: '' }),
      row({ price: '45.00' }),
    ])
    expect(total).toBe(12525)
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
  it('drops unnamed rows and resolves the category name', () => {
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
      { name: 'Milk', quantity: 2, priceMinor: 9000, categoryId: 'cat-1', categoryName: 'Groceries' },
      { name: 'Soap', quantity: 1, priceMinor: null, categoryId: null, categoryName: null },
    ])
  })
})
