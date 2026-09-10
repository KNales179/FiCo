import {
  shoppingItemRepository,
  shoppingListRepository,
} from '../../repositories'
import { enqueueMutation } from '../sync/enqueue'
import type { MutationContext } from '../sync/context'
import type { ShoppingList } from '../../types/models'

export interface NewListInput {
  title: string
  plannedBudgetMinor?: number | null
  plannedAt?: string | null
  visibility?: 'SPACE' | 'PRIVATE'
}

export const listShoppingLists = (
  spaceId: string,
): Promise<ShoppingList[]> => shoppingListRepository.listBySpace(spaceId)

export const getShoppingList = (
  id: string,
): Promise<ShoppingList | undefined> => shoppingListRepository.get(id)

export const createShoppingList = async (
  ctx: MutationContext,
  input: NewListInput,
): Promise<ShoppingList> => {
  const list = await shoppingListRepository.create({
    spaceId: ctx.spaceId,
    title: input.title.trim(),
    status: 'ACTIVE',
    plannedBudgetMinor: input.plannedBudgetMinor ?? null,
    plannedAt: input.plannedAt ?? null,
    completedAt: null,
    visibility: input.visibility ?? 'SPACE',
    createdBy: ctx.userId,
    syncStatus: 'PENDING',
    version: 1,
  })
  await enqueueMutation(ctx, 'shoppingList', list.id, 'CREATE', list)
  return list
}

export const updateShoppingList = async (
  ctx: MutationContext,
  id: string,
  patch: Partial<
    Pick<
      ShoppingList,
      'title' | 'plannedBudgetMinor' | 'status' | 'visibility'
    >
  >,
): Promise<ShoppingList> => {
  const list = await shoppingListRepository.update(id, {
    ...patch,
    syncStatus: 'PENDING',
  })
  await enqueueMutation(ctx, 'shoppingList', id, 'UPDATE', list)
  return list
}

export const cancelShoppingList = (ctx: MutationContext, id: string) =>
  updateShoppingList(ctx, id, { status: 'CANCELLED' })

export const completeShoppingList = async (
  ctx: MutationContext,
  id: string,
): Promise<ShoppingList> => {
  const list = await shoppingListRepository.update(id, {
    status: 'COMPLETED',
    completedAt: new Date().toISOString(),
    syncStatus: 'PENDING',
  })
  await enqueueMutation(ctx, 'shoppingList', id, 'UPDATE', list)
  return list
}

export const deleteShoppingList = async (
  ctx: MutationContext,
  id: string,
): Promise<void> => {
  const items = await shoppingItemRepository.listByList(id)
  for (const item of items) {
    await shoppingItemRepository.softDelete(item.id)
  }
  await shoppingListRepository.softDelete(id)
  await enqueueMutation(ctx, 'shoppingList', id, 'DELETE', { id })
}
