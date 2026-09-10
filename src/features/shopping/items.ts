import { shoppingItemRepository } from '../../repositories'
import { enqueueMutation } from '../sync/enqueue'
import type { MutationContext } from '../sync/context'
import type { ShoppingItem } from '../../types/models'

export interface NewItemInput {
  name: string
  plannedPriceMinor?: number | null
  quantity?: number
  addedDuringTrip?: boolean
}

export const listItems = (listId: string): Promise<ShoppingItem[]> =>
  shoppingItemRepository.listByList(listId)

export const addItem = async (
  ctx: MutationContext,
  listId: string,
  input: NewItemInput,
): Promise<ShoppingItem> => {
  const item = await shoppingItemRepository.create({
    spaceId: ctx.spaceId,
    shoppingListId: listId,
    itemProfileId: null,
    name: input.name.trim(),
    plannedPriceMinor: input.plannedPriceMinor ?? null,
    actualPriceMinor: null,
    quantity: input.quantity ?? 1,
    checked: false,
    purchased: false,
    addedDuringTrip: input.addedDuringTrip ?? false,
    transactionId: null,
    createdBy: ctx.userId,
    syncStatus: 'PENDING',
    version: 1,
  })
  await enqueueMutation(ctx, 'shoppingItem', item.id, 'CREATE', item)
  return item
}

export const updateItem = async (
  ctx: MutationContext,
  id: string,
  patch: Partial<
    Pick<
      ShoppingItem,
      'name' | 'plannedPriceMinor' | 'actualPriceMinor' | 'quantity'
    >
  >,
): Promise<ShoppingItem> => {
  const item = await shoppingItemRepository.update(id, {
    ...patch,
    syncStatus: 'PENDING',
  })
  await enqueueMutation(ctx, 'shoppingItem', id, 'UPDATE', item)
  return item
}

export const setItemChecked = async (
  ctx: MutationContext,
  id: string,
  checked: boolean,
): Promise<ShoppingItem> => {
  const item = await shoppingItemRepository.update(id, {
    checked,
    syncStatus: 'PENDING',
  })
  await enqueueMutation(
    ctx,
    'shoppingItem',
    id,
    checked ? 'CHECK' : 'UNCHECK',
    { id, checked },
  )
  return item
}

export const removeItem = async (
  ctx: MutationContext,
  id: string,
): Promise<void> => {
  await shoppingItemRepository.softDelete(id)
  await enqueueMutation(ctx, 'shoppingItem', id, 'DELETE', { id })
}
