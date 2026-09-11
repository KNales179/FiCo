import { describe, expect, it } from 'vitest'
import { compareElectricityPeriods, costPerKwhMinor } from './electricity'

describe('costPerKwhMinor', () => {
  it('divides amount by consumption', () => {
    expect(costPerKwhMinor(254300, 210)).toBe(1211)
  })

  it('is null when consumption is unknown or zero', () => {
    expect(costPerKwhMinor(254300, null)).toBeNull()
    expect(costPerKwhMinor(254300, undefined)).toBeNull()
    expect(costPerKwhMinor(254300, 0)).toBeNull()
  })
})

describe('compareElectricityPeriods', () => {
  it('compares a period against the one right before it', () => {
    const rows = compareElectricityPeriods([
      { billingPeriod: '2026-08', amountMinor: 300000, consumptionKwh: 200 },
      { billingPeriod: '2026-09', amountMinor: 330000, consumptionKwh: 220 },
    ])
    const sep = rows.find((r) => r.billingPeriod === '2026-09')!
    expect(sep.amountVsPriorPct).toBeCloseTo(10, 5)
    expect(sep.kwhVsPriorPct).toBeCloseTo(10, 5)
  })

  it('compares a period against the same month a year earlier', () => {
    const rows = compareElectricityPeriods([
      { billingPeriod: '2025-09', amountMinor: 300000, consumptionKwh: 200 },
      { billingPeriod: '2026-08', amountMinor: 310000, consumptionKwh: 205 },
      { billingPeriod: '2026-09', amountMinor: 360000, consumptionKwh: 200 },
    ])
    const sep2026 = rows.find((r) => r.billingPeriod === '2026-09')!
    // Same consumption as last September, but 20% more expensive — a rate
    // change, not a usage change, and the two comparisons tell that apart.
    expect(sep2026.amountVsLastYearPct).toBeCloseTo(20, 5)
    expect(sep2026.kwhVsLastYearPct).toBeCloseTo(0, 5)
  })

  it('has no prior/last-year comparison for the first period on record', () => {
    const rows = compareElectricityPeriods([
      { billingPeriod: '2026-09', amountMinor: 300000, consumptionKwh: 200 },
    ])
    expect(rows[0].amountVsPriorPct).toBeNull()
    expect(rows[0].amountVsLastYearPct).toBeNull()
    expect(rows[0].kwhVsPriorPct).toBeNull()
  })

  it('handles a missing consumption reading without throwing', () => {
    const rows = compareElectricityPeriods([
      { billingPeriod: '2026-08', amountMinor: 300000, consumptionKwh: null },
      { billingPeriod: '2026-09', amountMinor: 330000, consumptionKwh: 220 },
    ])
    const sep = rows.find((r) => r.billingPeriod === '2026-09')!
    expect(sep.kwhVsPriorPct).toBeNull()
    expect(sep.amountVsPriorPct).toBeCloseTo(10, 5)
  })

  it('sorts the output by billing period regardless of input order', () => {
    const rows = compareElectricityPeriods([
      { billingPeriod: '2026-09', amountMinor: 1, consumptionKwh: 1 },
      { billingPeriod: '2026-07', amountMinor: 1, consumptionKwh: 1 },
      { billingPeriod: '2026-08', amountMinor: 1, consumptionKwh: 1 },
    ])
    expect(rows.map((r) => r.billingPeriod)).toEqual([
      '2026-07',
      '2026-08',
      '2026-09',
    ])
  })
})
