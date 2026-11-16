import { describe, expect, it } from 'vitest'
import { customTokens, inkFor, wheelColor, wheelPosition } from './color'

describe('custom colours', () => {
  it('picks readable text for light and dark colours', () => {
    expect(inkFor('#ffffff')).toBe('#1a1626')
    expect(inkFor('#1e1b4b')).toBe('#ffffff')
  })
  it('deepens very light colours on light backgrounds and lifts very dark ones on dark', () => {
    expect(customTokens('#fffbe0').light.brand).not.toBe('#fffbe0')
    expect(customTokens('#0a0a30').dark.brand).not.toBe('#0a0a30')
    expect(customTokens('#2563eb').light.brand).toBe('#2563eb')
  })
  it('finds a colour back on the wheel', () => {
    const hex = wheelColor(200, 0.8)
    const pos = wheelPosition(hex)
    expect(Math.abs(pos.hue - 200)).toBeLessThan(2)
    expect(Math.abs(pos.sat - 0.8)).toBeLessThan(0.02)
  })
})
