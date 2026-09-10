import { categoryRepository } from '../../repositories'
import { enqueueMutation } from '../sync/enqueue'
import type { MutationContext } from '../sync/context'
import type { Category, CategoryKind } from '../../types/models'

export const normalizeCategoryName = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, ' ')

const DEFAULTS: Array<{ name: string; kind: CategoryKind }> = [
  { name: 'Food', kind: 'EXPENSE' },
  { name: 'Groceries', kind: 'EXPENSE' },
  { name: 'Transportation', kind: 'EXPENSE' },
  { name: 'Bills', kind: 'EXPENSE' },
  { name: 'Health', kind: 'EXPENSE' },
  { name: 'Shopping', kind: 'EXPENSE' },
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

/** Seed the default list the first time a space has no categories locally. */
export const ensureDefaultCategories = async (
  ctx: MutationContext,
): Promise<void> => {
  const existing = await categoryRepository.listBySpace(ctx.spaceId)
  if (existing.length > 0) return

  for (const def of DEFAULTS) {
    const category = await categoryRepository.create({
      spaceId: ctx.spaceId,
      name: def.name,
      normalizedName: normalizeCategoryName(def.name),
      kind: def.kind,
      archived: false,
      createdBy: ctx.userId,
      syncStatus: 'PENDING',
      version: 1,
    })
    await enqueueMutation(ctx, 'category', category.id, 'CREATE', category)
  }
}

export const createCategory = async (
  ctx: MutationContext,
  input: { name: string; kind: CategoryKind },
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
  patch: { name?: string; archived?: boolean },
): Promise<Category> => {
  const next: Partial<Category> = { syncStatus: 'PENDING' }
  if (patch.name !== undefined) {
    next.name = patch.name.trim()
    next.normalizedName = normalizeCategoryName(patch.name)
  }
  if (patch.archived !== undefined) next.archived = patch.archived

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
