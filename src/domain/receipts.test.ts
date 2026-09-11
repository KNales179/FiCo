import { describe, expect, it } from 'vitest'
import { parseReceiptText } from './receipts'

describe('parseReceiptText', () => {
  it('reads merchant, an unambiguous ISO date, items, tax and total', () => {
    const receipt = `
SUPERMART GROCERIES
123 Main Street
Branch: Quezon City
Date: 2026-03-14
2 x Milk 1L                 90.00
Bread Loaf                  45.00
Eggs Tray                  120.00
SUBTOTAL                    255.00
VAT                          30.60
TOTAL                       285.60
CASH                        300.00
CHANGE                       14.40
THANK YOU
`
    const r = parseReceiptText(receipt)

    expect(r.merchant).toBe('SUPERMART GROCERIES')
    expect(r.occurredAt).toBe('2026-03-14')
    expect(r.totalMinor).toBe(28560)
    expect(r.taxMinor).toBe(3060)
    expect(r.items).toEqual([
      { name: 'Milk 1L', quantity: 2, priceMinor: 9000 },
      { name: 'Bread Loaf', quantity: 1, priceMinor: 4500 },
      { name: 'Eggs Tray', quantity: 1, priceMinor: 12000 },
    ])
  })

  it('reads a month-name date regardless of day/month order', () => {
    expect(parseReceiptText('Jan 5, 2026\nTOTAL 10.00').occurredAt).toBe(
      '2026-01-05',
    )
    expect(parseReceiptText('5 January 2026\nTOTAL 10.00').occurredAt).toBe(
      '2026-01-05',
    )
  })

  it('never guesses an ambiguous numeric date — leaves it null', () => {
    // 05/06/2026 could be 5 June or 6 May; refuse rather than pick one.
    const r = parseReceiptText('05/06/2026\nTOTAL 12.00')
    expect(r.occurredAt).toBeNull()
  })

  it('rejects an impossible date instead of returning garbage', () => {
    expect(parseReceiptText('2026-13-40\nTOTAL 1.00').occurredAt).toBeNull()
  })

  it('never defaults the date to "today" when nothing is readable', () => {
    const r = parseReceiptText('SOME STORE\nTOTAL 50.00')
    expect(r.occurredAt).toBeNull()
  })

  it('leaves total/tax null when the receipt text has none', () => {
    const r = parseReceiptText('SOME STORE\nMilk 45.00\nBread 30.00')
    expect(r.totalMinor).toBeNull()
    expect(r.taxMinor).toBeNull()
    expect(r.items).toHaveLength(2)
  })

  it('keeps an item row with a null price when a name has no readable price', () => {
    const r = parseReceiptText('Mystery item without a price line\nTOTAL 10.00')
    // No trailing money-looking number -> not treated as an item at all,
    // which is the safe default (no invented row for noise text).
    expect(r.items).toHaveLength(0)
  })

  it('does not mistake subtotal for the total when both are present', () => {
    const r = parseReceiptText('SUBTOTAL 100.00\nTOTAL 112.00')
    expect(r.totalMinor).toBe(11200)
  })

  it('ignores receipt boilerplate lines as items', () => {
    const r = parseReceiptText(
      'STORE NAME\nCASHIER: JUAN\nDATE: 2026-01-01\nTIME: 10:30\nTOTAL 5.00',
    )
    expect(r.items).toHaveLength(0)
  })

  it('picks the last (grand) total when several total-like lines appear', () => {
    const r = parseReceiptText('Total due 50.00\nAMOUNT DUE 55.00')
    expect(r.totalMinor).toBe(5500)
  })
})
