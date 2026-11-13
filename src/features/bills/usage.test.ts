import { describe, expect, it } from 'vitest'
import { formatUsage, recordKindOf, sumByPeriod, usageKindOf } from './usage'

describe('usage tracking', () => {
  it('treats older electricity-only bills and readings as electricity', () => {
    expect(usageKindOf({ tracksElectricity: true })).toBe('ELECTRICITY')
    expect(usageKindOf({ tracksElectricity: false })).toBeNull()
    expect(usageKindOf({ tracksElectricity: false, usageKind: 'WATER' })).toBe('WATER')
    expect(recordKindOf({})).toBe('ELECTRICITY')
    expect(recordKindOf({ usageKind: 'LPG' })).toBe('LPG')
  })

  it('prints the unit and trims decimals', () => {
    expect(formatUsage(18, 'WATER')).toBe('18 m³')
    expect(formatUsage(40.456, 'FUEL')).toBe('40.46 L')
  })

  it('adds up several refills in the same month', () => {
    const rows = sumByPeriod([
      { billingPeriod: '2026-10-03T08:00:00.000Z', amountMinor: 95000, consumptionKwh: 11 },
      { billingPeriod: '2026-09-20T08:00:00.000Z', amountMinor: 92000, consumptionKwh: 11 },
      { billingPeriod: '2026-10-28T08:00:00.000Z', amountMinor: 30000, consumptionKwh: 2.7 },
    ])
    expect(rows).toEqual([
      { billingPeriod: '2026-09', amountMinor: 92000, consumptionKwh: 11 },
      { billingPeriod: '2026-10', amountMinor: 125000, consumptionKwh: 13.7 },
    ])
  })
})
