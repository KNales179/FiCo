/** Lightweight in-page pub/sub so the sync engine and the data providers stay
 *  in step without threading callbacks through every module. */

export const MUTATION_EVENT = 'fico:mutation'
export const DATA_CHANGED_EVENT = 'fico:data-changed'

const emit = (name: string) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(name))
  }
}

/** A local mutation was just queued — a good moment to sync. */
export const emitMutation = () => emit(MUTATION_EVENT)

/** Remote changes were applied to IndexedDB — providers should reload. */
export const emitDataChanged = () => emit(DATA_CHANGED_EVENT)

export const onDataChanged = (handler: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(DATA_CHANGED_EVENT, handler)
  return () => window.removeEventListener(DATA_CHANGED_EVENT, handler)
}

export const onMutation = (handler: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(MUTATION_EVENT, handler)
  return () => window.removeEventListener(MUTATION_EVENT, handler)
}
