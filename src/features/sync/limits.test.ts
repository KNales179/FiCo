import { describe, expect, it } from 'vitest'
import { fitToServerLimits } from './limits'

describe('fitToServerLimits', () => {
  it('trims over-long text to what the server accepts', () => {
    const out = fitToServerLimits('transaction', { title: 'x'.repeat(200), categoryName: 'c'.repeat(70), amountMinor: 5 }) as Record<string, unknown>
    expect((out.title as string).length).toBe(120)
    expect((out.categoryName as string).length).toBe(60)
    expect(out.amountMinor).toBe(5)
  })

  it('leaves fitting payloads and unknown types alone', () => {
    const payload = { title: 'Lunch' }
    expect(fitToServerLimits('transaction', payload)).toEqual(payload)
    expect(fitToServerLimits('somethingElse', { name: 'y'.repeat(500) })).toEqual({ name: 'y'.repeat(500) })
    expect(fitToServerLimits('transaction', { id: 'a' })).toEqual({ id: 'a' })
  })

  it('caps budget plan lists and their item names', () => {
    const items = Array.from({ length: 60 }, (_, i) => ({ id: String(i), name: 'n'.repeat(100), amountMinor: 1 }))
    const out = fitToServerLimits('budgetPlan', { plannedItems: items, weeklyStaples: items }) as {
      plannedItems: { name: string }[]
      weeklyStaples: { name: string }[]
    }
    expect(out.plannedItems).toHaveLength(50)
    expect(out.plannedItems[0].name).toHaveLength(80)
    expect(out.weeklyStaples).toHaveLength(50)
  })
})
