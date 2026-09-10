/** Amount ÷ kWh, in minor units. Null when consumption is unknown or zero. */
export const costPerKwhMinor = (
  amountMinor: number,
  consumptionKwh: number | null | undefined,
): number | null =>
  consumptionKwh && consumptionKwh > 0
    ? Math.round(amountMinor / consumptionKwh)
    : null
