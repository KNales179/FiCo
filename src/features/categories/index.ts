import { categoryRepository } from '../../repositories'
import { enqueueMutation } from '../sync/enqueue'
import type { MutationContext } from '../sync/context'
import type { Category, CategoryKind } from '../../types/models'

export const normalizeCategoryName = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, ' ')

const DEFAULTS: Array<{
  name: string
  kind: CategoryKind
  tracksItems?: boolean
}> = [
  { name: 'Food', kind: 'EXPENSE' },
  { name: 'Groceries', kind: 'EXPENSE', tracksItems: true },
  { name: 'Transportation', kind: 'EXPENSE' },
  { name: 'Bills', kind: 'EXPENSE' },
  { name: 'Health', kind: 'EXPENSE' },
  { name: 'Shopping', kind: 'EXPENSE', tracksItems: true },
  { name: 'Entertainment', kind: 'EXPENSE' },
  { name: 'Education', kind: 'EXPENSE' },
  { name: 'Other', kind: 'EXPENSE' },
  { name: 'Salary', kind: 'INCOME' },
  { name: 'Other income', kind: 'INCOME' },
]

export const listCategories = (spaceId: string): Promise<Category[]> =>
  categoryRepository.listBySpace(spaceId)

export const categoryName = async (
  id: string | null | undefined,
): Promise<string | null> => {
  if (!id) return null
  return (await categoryRepository.get(id))?.name ?? null
}

/** Same id on every device, for the same space's same default — so two
 *  devices seeding the same space (e.g. one just cleared its local data,
 *  before its first pull) land on the exact same record instead of
 *  creating a duplicate. The push endpoint already merges a CREATE into
 *  a matching existing id rather than treating it as a second record. */
const defaultCategoryId = (spaceId: string, name: string): string =>
  `default-${spaceId}-${normalizeCategoryName(name).replace(/\s+/g, '-')}`

/**
 * Seed any default this space doesn't have yet — per-default, not "skip
 * entirely if the space already has anything", so this is safe to call on
 * every load. Checked by name+kind *including* an already soft-deleted
 * one, so intentionally deleting a default doesn't bring it back next
 * time this runs.
 */
export const ensureDefaultCategories = async (
  ctx: MutationContext,
): Promise<void> => {
  for (const def of DEFAULTS) {
    const normalizedName = normalizeCategoryName(def.name)
    const rows = await categoryRepository.getAllByIndex(
      'by-space-kind',
      [ctx.spaceId, def.kind],
      { includeDeleted: true },
    )
    if (rows.some((c) => c.normalizedName === normalizedName)) continue

    const category = await categoryRepository.create({
      id: defaultCategoryId(ctx.spaceId, def.name),
      spaceId: ctx.spaceId,
      name: def.name,
      normalizedName,
      kind: def.kind,
      archived: false,
      tracksItems: def.tracksItems ?? false,
      createdBy: ctx.userId,
      syncStatus: 'PENDING',
      version: 1,
    })
    await enqueueMutation(ctx, 'category', category.id, 'CREATE', category)
  }
}

/**
 * One-time cleanup for exactly the bug above, before this fix existed: two
 * of every default category, from a device that re-seeded the space after
 * a locally-empty start (a cleared cache, or a first sync that hadn't
 * landed yet) before catching up with what the space already had. Merges
 * same-name-same-kind categories down to the oldest one; anything that
 * already pointed at a duplicate (a transaction's own name snapshot, an
 * item profile's category) keeps resolving correctly regardless — a
 * category's name is still readable long after the row itself is gone
 * (§10, same rule everywhere else). Safe to call every load: nothing to
 * do once there's only one of each.
 */
export const dedupeCategories = async (ctx: MutationContext): Promise<void> => {
  const categories = await categoryRepository.listBySpace(ctx.spaceId)
  const byKey = new Map<string, Category[]>()
  for (const cat of categories) {
    const key = `${cat.kind}:${cat.normalizedName}`
    byKey.set(key, [...(byKey.get(key) ?? []), cat])
  }

  for (const group of byKey.values()) {
    if (group.length <= 1) continue
    const [, ...duplicates] = [...group].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    )
    for (const dup of duplicates) {
      await categoryRepository.softDelete(dup.id)
      await enqueueMutation(ctx, 'category', dup.id, 'DELETE', { id: dup.id })
    }
  }
}

export const createCategory = async (
  ctx: MutationContext,
  input: { name: string; kind: CategoryKind; tracksItems?: boolean },
): Promise<Category> => {
  const normalizedName = normalizeCategoryName(input.name)
  const existing = await categoryRepository.findByName(
    ctx.spaceId,
    input.kind,
    normalizedName,
  )
  if (existing) {
    throw new Error('That category already exists')
  }

  const category = await categoryRepository.create({
    spaceId: ctx.spaceId,
    name: input.name.trim(),
    normalizedName,
    kind: input.kind,
    archived: false,
    tracksItems: input.tracksItems ?? false,
    createdBy: ctx.userId,
    syncStatus: 'PENDING',
    version: 1,
  })
  await enqueueMutation(ctx, 'category', category.id, 'CREATE', category)
  return category
}

export const updateCategory = async (
  ctx: MutationContext,
  id: string,
  patch: { name?: string; archived?: boolean; tracksItems?: boolean },
): Promise<Category> => {
  const next: Partial<Category> = { syncStatus: 'PENDING' }
  if (patch.name !== undefined) {
    next.name = patch.name.trim()
    next.normalizedName = normalizeCategoryName(patch.name)
  }
  if (patch.archived !== undefined) next.archived = patch.archived
  if (patch.tracksItems !== undefined) next.tracksItems = patch.tracksItems

  const category = await categoryRepository.update(id, next)
  await enqueueMutation(ctx, 'category', id, 'UPDATE', category)
  return category
}

export const deleteCategory = async (
  ctx: MutationContext,
  id: string,
): Promise<void> => {
  await categoryRepository.softDelete(id)
  await enqueueMutation(ctx, 'category', id, 'DELETE', { id })
}
