/** Chart colour slots (see index.css "Charts") and axis number formatting. */

export const CATEGORY_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
]
export const OTHER_COLOR = 'var(--chart-other)'

/** ₱1.2k / ₱35k / ₱1.4M — axis labels only; tooltips show the full amount. */
export const compactMoney = (minor: number, currency = 'PHP') => {
  const major = minor / 100
  const sym = currency === 'PHP' ? '₱' : ''
  const abs = Math.abs(major)
  const text =
    abs >= 1_000_000
      ? `${(major / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
      : abs >= 1000
        ? `${(major / 1000).toFixed(abs >= 10_000 ? 0 : 1).replace(/\.0$/, '')}k`
        : `${Math.round(major)}`
  return sym ? `${sym}${text}` : `${text} ${currency}`
}
