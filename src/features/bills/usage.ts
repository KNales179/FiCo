import type { Bill, ElectricityRecord } from '../../types/models'

/**
 * What a bill can track besides its amount: how much was used, in that
 * utility's own unit — so Fico can show cost per unit and whether a higher
 * bill came from using more or from a price increase. Common in the
 * Philippines: electricity (Meralco, electric co-ops), water (PrimeWater,
 * Maynilad, Manila Water, local water districts), LPG refills, and fuel.
 */
export type UsageKind = 'ELECTRICITY' | 'WATER' | 'LPG' | 'FUEL'

export interface UsageInfo {
  label: string
  /** Short unit, as printed after a number. */
  unit: string
  /** e.g. "₱/kWh" column header. */
  perUnit: string
  /** Shown in the bill form's picker. */
  option: string
  /** Placeholder / label for the pay form's usage box. */
  inputLabel: string
  examples: string
}

export const USAGE: Record<UsageKind, UsageInfo> = {
  ELECTRICITY: {
    label: 'Electricity',
    unit: 'kWh',
    perUnit: '/kWh',
    option: 'Electricity — kWh',
    inputLabel: 'kWh used',
    examples: 'Meralco, electric co-ops',
  },
  WATER: {
    label: 'Water',
    unit: 'm³',
    perUnit: '/m³',
    option: 'Water — cubic metres (m³)',
    inputLabel: 'm³ used',
    examples: 'PrimeWater, Maynilad, Manila Water, water districts',
  },
  LPG: {
    label: 'LPG',
    unit: 'kg',
    perUnit: '/kg',
    option: 'LPG — kg per refill',
    inputLabel: 'kg (tank size)',
    examples: 'Petron Gasul, Solane, Regasco…',
  },
  FUEL: {
    label: 'Fuel',
    unit: 'L',
    perUnit: '/L',
    option: 'Fuel — litres',
    inputLabel: 'Litres',
    examples: 'gasoline, diesel',
  },
}

export const USAGE_KINDS: UsageKind[] = ['ELECTRICITY', 'WATER', 'LPG', 'FUEL']

/** The bill's usage kind — older bills only had the electricity switch. */
export const usageKindOf = (bill: Pick<Bill, 'tracksElectricity'> & { usageKind?: UsageKind | null }): UsageKind | null =>
  bill.usageKind ?? (bill.tracksElectricity ? 'ELECTRICITY' : null)

/** A usage reading's kind — every reading from before this was electricity. */
export const recordKindOf = (record: Pick<ElectricityRecord, 'usageKind'>): UsageKind => record.usageKind ?? 'ELECTRICITY'

/** "231 kWh", "18 m³", "11 kg", "40 L" (trims needless decimals). */
export const formatUsage = (amount: number, kind: UsageKind) =>
  `${Number.isInteger(amount) ? amount : Number(amount.toFixed(2))} ${USAGE[kind].unit}`

/**
 * Readings added up per month (per year for yearly bills) — an anytime bill
 * like LPG or fuel can be paid several times a month, and trends compare
 * month to month.
 */
export const sumByPeriod = (
  records: Array<{ billingPeriod: string; amountMinor: number; consumptionKwh?: number | null }>,
): Array<{ billingPeriod: string; amountMinor: number; consumptionKwh: number | null }> => {
  const byPeriod = new Map<string, { billingPeriod: string; amountMinor: number; consumptionKwh: number | null }>()
  for (const r of records) {
    const period = /^\d{4}-\d{2}/.test(r.billingPeriod) ? r.billingPeriod.slice(0, 7) : r.billingPeriod
    const row = byPeriod.get(period) ?? { billingPeriod: period, amountMinor: 0, consumptionKwh: null }
    row.amountMinor += r.amountMinor
    if (r.consumptionKwh != null) row.consumptionKwh = (row.consumptionKwh ?? 0) + r.consumptionKwh
    byPeriod.set(period, row)
  }
  return [...byPeriod.values()].sort((a, b) => a.billingPeriod.localeCompare(b.billingPeriod))
}

/** A period for display: "2026-11", or a plain date for an anytime payment. */
export const periodLabel = (period: string) => (period.length > 10 ? period.slice(0, 10) : period)
