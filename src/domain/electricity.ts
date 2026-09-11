import { priorPeriods } from './budget'

/** Amount ÷ kWh, in minor units. Null when consumption is unknown or zero. */
export const costPerKwhMinor = (
  amountMinor: number,
  consumptionKwh: number | null | undefined,
): number | null =>
  consumptionKwh && consumptionKwh > 0
    ? Math.round(amountMinor / consumptionKwh)
    : null

/** Percent change from `from` to `to` — null when there's nothing to compare against. */
const pctChange = (
  from: number | null | undefined,
  to: number | null | undefined,
): number | null =>
  from == null || to == null || from === 0 ? null : ((to - from) / from) * 100

const MONTHLY_PERIOD = /^\d{4}-\d{2}$/

/** Same calendar month, one year earlier — null for anything not shaped "YYYY-MM". */
const sameMonthLastYear = (period: string): string | null => {
  if (!MONTHLY_PERIOD.test(period)) return null
  const [year, month] = period.split('-')
  return `${Number(year) - 1}-${month}`
}

export interface ElectricityPeriodComparison {
  billingPeriod: string
  amountMinor: number
  consumptionKwh: number | null
  costPerKwhMinor: number | null
  /** vs the immediately preceding billed period, if there is one. */
  amountVsPriorPct: number | null
  kwhVsPriorPct: number | null
  /** vs the same calendar month a year earlier, if that one was billed too. */
  amountVsLastYearPct: number | null
  kwhVsLastYearPct: number | null
}

/**
 * Month-over-month and year-over-year comparisons across a bill's own
 * billed periods. Built for electricity specifically — the point the owner
 * raised: a FIXED bill's amount never moves, so there's nothing there worth
 * comparing, but electricity's amount *and* consumption both move
 * independently, and knowing which one moved (a rate hike vs. actually
 * using more power) is the useful question. Works on any per-period record
 * shaped the same way, so it isn't tied to the `ElectricityRecord` type.
 */
export const compareElectricityPeriods = (
  records: Array<{
    billingPeriod: string
    amountMinor: number
    consumptionKwh?: number | null
  }>,
): ElectricityPeriodComparison[] => {
  const sorted = [...records].sort((a, b) =>
    a.billingPeriod.localeCompare(b.billingPeriod),
  )
  const byPeriod = new Map(sorted.map((r) => [r.billingPeriod, r]))

  return sorted.map((r) => {
    const priorKey = MONTHLY_PERIOD.test(r.billingPeriod)
      ? priorPeriods(r.billingPeriod, 1)[0]
      : null
    const prior = priorKey ? byPeriod.get(priorKey) : undefined
    const lastYear = byPeriod.get(sameMonthLastYear(r.billingPeriod) ?? '')

    return {
      billingPeriod: r.billingPeriod,
      amountMinor: r.amountMinor,
      consumptionKwh: r.consumptionKwh ?? null,
      costPerKwhMinor: costPerKwhMinor(r.amountMinor, r.consumptionKwh),
      amountVsPriorPct: pctChange(prior?.amountMinor, r.amountMinor),
      kwhVsPriorPct: pctChange(prior?.consumptionKwh, r.consumptionKwh),
      amountVsLastYearPct: pctChange(lastYear?.amountMinor, r.amountMinor),
      kwhVsLastYearPct: pctChange(lastYear?.consumptionKwh, r.consumptionKwh),
    }
  })
}
