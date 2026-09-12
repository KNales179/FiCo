import { describe, expect, it } from 'vitest'
import { isUnseen } from './index'

describe('isUnseen', () => {
  it('is unseen when added by someone else after the last-seen cursor', () => {
    expect(
      isUnseen('2026-09-13T10:00:00.000Z', 'user-2', '2026-09-13T09:00:00.000Z', 'user-1'),
    ).toBe(true)
  })

  it('is never unseen for your own addition, no matter the cursor', () => {
    expect(
      isUnseen('2026-09-13T10:00:00.000Z', 'user-1', '2026-09-13T09:00:00.000Z', 'user-1'),
    ).toBe(false)
  })

  it('is not unseen once the cursor has caught up to it', () => {
    expect(
      isUnseen('2026-09-13T10:00:00.000Z', 'user-2', '2026-09-13T11:00:00.000Z', 'user-1'),
    ).toBe(false)
  })

  it('is unseen when there is no cursor yet (never visited)', () => {
    expect(isUnseen('2026-09-13T10:00:00.000Z', 'user-2', null, 'user-1')).toBe(true)
  })

  it('is never unseen when createdBy is missing (nothing to attribute)', () => {
    expect(isUnseen('2026-09-13T10:00:00.000Z', null, null, 'user-1')).toBe(false)
    expect(isUnseen('2026-09-13T10:00:00.000Z', undefined, null, 'user-1')).toBe(false)
  })
})
