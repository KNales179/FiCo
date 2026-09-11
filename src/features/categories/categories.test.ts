import { beforeEach, describe, expect, it } from 'vitest'
import { ctx, withDB } from '../../test/helpers'
import { categoryRepository } from '../../repositories'
import {
  dedupeCategories,
  ensureDefaultCategories,
  listCategories,
} from './index'

const c = ctx()

describe('ensureDefaultCategories', () => {
  beforeEach(withDB)

  it('seeds every default exactly once', async () => {
    await ensureDefaultCategories(c)
    const names = (await listCategories(c.spaceId)).map((cat) => cat.name)
    expect(names).toContain('Groceries')
    expect(names).toContain('Bills')
    expect(names).toContain('Salary')
    expect(new Set(names).size).toBe(names.length) // no repeats
  })

  it('running it again creates nothing new — the bug this fixes', async () => {
    await ensureDefaultCategories(c)
    const first = await listCategories(c.spaceId)

    await ensureDefaultCategories(c)
    const second = await listCategories(c.spaceId)

    expect(second).toHaveLength(first.length)
  })

  it('does not duplicate a default that already exists under a different id', async () => {
    // Simulates the actual race: another device (or an earlier sync) already
    // created "Bills" with a random id before this device's first seed ran.
    await categoryRepository.create({
      spaceId: c.spaceId,
      name: 'Bills',
      normalizedName: 'bills',
      kind: 'EXPENSE',
      archived: false,
      tracksItems: false,
      createdBy: c.userId,
      syncStatus: 'SYNCED',
      version: 1,
    })

    await ensureDefaultCategories(c)

    const bills = (await listCategories(c.spaceId)).filter(
      (cat) => cat.normalizedName === 'bills',
    )
    expect(bills).toHaveLength(1)
  })

  it('never resurrects a default the person deliberately deleted', async () => {
    await ensureDefaultCategories(c)
    const other = (await listCategories(c.spaceId)).find(
      (cat) => cat.name === 'Other',
    )!
    await categoryRepository.softDelete(other.id)

    await ensureDefaultCategories(c)

    expect(
      (await listCategories(c.spaceId)).some((cat) => cat.name === 'Other'),
    ).toBe(false)
  })
})

describe('dedupeCategories', () => {
  beforeEach(withDB)

  it('merges a duplicate pair down to a single survivor, data intact', async () => {
    // Two categories with the same name+kind, from two seeding passes — the
    // actual bug in the wild ("Groceries" showing up twice).
    for (let i = 0; i < 2; i += 1) {
      await categoryRepository.create({
        spaceId: c.spaceId,
        name: 'Groceries',
        normalizedName: 'groceries',
        kind: 'EXPENSE',
        archived: false,
        tracksItems: true,
        createdBy: c.userId,
        syncStatus: 'SYNCED',
        version: 1,
      })
    }
    expect(await listCategories(c.spaceId)).toHaveLength(2)

    await dedupeCategories(c)

    const remaining = await listCategories(c.spaceId)
    expect(remaining).toHaveLength(1)
    expect(remaining[0]).toMatchObject({
      name: 'Groceries',
      normalizedName: 'groceries',
      tracksItems: true,
    })
  })

  it('does nothing when there is nothing to merge', async () => {
    await categoryRepository.create({
      spaceId: c.spaceId,
      name: 'Groceries',
      normalizedName: 'groceries',
      kind: 'EXPENSE',
      archived: false,
      tracksItems: true,
      createdBy: c.userId,
      syncStatus: 'SYNCED',
      version: 1,
    })
    await dedupeCategories(c)
    expect(await listCategories(c.spaceId)).toHaveLength(1)
  })
})
