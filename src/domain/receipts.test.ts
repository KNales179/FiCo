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

  it('parses a real Philippine retail receipt layout (qty*unitPrice above the item line)', () => {
    // Transcribed from an actual Alfamart receipt (this feature's motivating
    // bug report) — quantity and unit price print on their own line above
    // the item name and its line total.
    const receipt = `
ALFAMART TRADING PHILIPPINES, INC.
ALFAMART, ATP BRGY MAYAO CROSSING LUCENA
ALFAMART LOT NO 3508-C-1-B PSD 185194 BR
VAT-REG TIN 008-685-624-02530
MIN 26061712311649678
SN# 0093202512122
SALES INVOICE NO. : 008488
1*80.250
GAR WHEAT BREAD 400                80.25
1*116.000
LC HAM POUCH 220ML                116.00
1*27.000
BINGO DBLE CHOCO 75G               27.00
1*34.000
NESTLE CHUCKIE 250ML               34.00
1*105.000
EMBORG SLCES 200G12S               105.00
3*15.000
KPKBLNCWNTRBLDMLW40G               45.00
   Promo Discount                 -22.00
      SUBTOTAL                    385.25
      TOTAL                       385.25
CASH                              1,000.00

Change                            614.75
   ITEM/S PURCHASED : 8

Vatable Sale                      343.97
VAT (12%)                          41.28
Vat Exempt Sale                     0.00
Zero Rated Sale                     0.00
`
    const r = parseReceiptText(receipt)

    expect(r.merchant).toBe('ALFAMART TRADING PHILIPPINES, INC.')
    expect(r.totalMinor).toBe(38525)
    // The real tax amount, not the "Vat Exempt" / "Vatable Sale" breakdown lines.
    expect(r.taxMinor).toBe(4128)
    expect(r.discountMinor).toBe(2200)
    // The receipt's own count, kept separate from the parsed item rows below
    // (6 line entries covering 8 units, once the 3x line is counted) so a
    // mismatch is visible rather than silently reconciled either way.
    expect(r.itemCount).toBe(8)
    // Nowhere near the TIN (17 digits) / MIN (17 digits) / invoice number
    // (6 digits) that sit right above the items -- none of those became a
    // fake item or a fake amount.
    expect(r.items.some((i) => i.priceMinor != null && i.priceMinor > 100000)).toBe(false)

    // Neither "Change", "Cash" nor the item-count line became a fake item.
    expect(r.items).toEqual([
      { name: 'GAR WHEAT BREAD 400', quantity: 1, priceMinor: 8025 },
      { name: 'LC HAM POUCH 220ML', quantity: 1, priceMinor: 11600 },
      { name: 'BINGO DBLE CHOCO 75G', quantity: 1, priceMinor: 2700 },
      { name: 'NESTLE CHUCKIE 250ML', quantity: 1, priceMinor: 3400 },
      { name: 'EMBORG SLCES 200G12S', quantity: 1, priceMinor: 10500 },
      // "3*15.000" above it -> quantity 3, even though its own line only
      // carries the line total (45.00), matching how Fico stores item
      // prices as line totals rather than unit prices.
      { name: 'KPKBLNCWNTRBLDMLW40G', quantity: 3, priceMinor: 4500 },
    ])
  })

  it('never treats a TIN / reference number as an amount', () => {
    const r = parseReceiptText('VAT-REG TIN 008-685-624-02530\nTOTAL 10.00')
    expect(r.taxMinor).toBeNull()
  })

  it('never turns a long serial/reference number into a fake item', () => {
    const r = parseReceiptText(
      'MIN 26061712311649678\nSN# 0093202512122\nMilk 45.00\nTOTAL 45.00',
    )
    expect(r.items).toEqual([{ name: 'Milk', quantity: 1, priceMinor: 4500 }])
  })

  it('still reads an item whose price has no decimal point (OCR noise)', () => {
    // A real item must not be dropped just because the cents got misread or
    // dropped -- only reference numbers (6+ run-on digits) are excluded.
    const r = parseReceiptText('Soda 45\nTOTAL 45.00')
    expect(r.items).toEqual([{ name: 'Soda', quantity: 1, priceMinor: 4500 }])
  })

  it('the receipt\'s printed item count is separate from the parsed rows', () => {
    const r = parseReceiptText('Milk 45.00\nITEM/S PURCHASED : 3\nTOTAL 45.00')
    expect(r.itemCount).toBe(3)
    expect(r.items).toHaveLength(1)
  })
})
