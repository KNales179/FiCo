/** Lightweight in-page pub/sub so the sync engine and the data providers stay
 *  in step without threading callbacks through every module. */

export const MUTATION_EVENT = 'fico:mutation'
export const DATA_CHANGED_EVENT = 'fico:data-changed'

const emit = (name: string) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(name))
  }
}

// Local edits come in bursts (finishing a shopping trip writes many rows),
// so the "data changed" signal they cause is coalesced into one.
let localChangeTimer: ReturnType<typeof setTimeout> | null = null

/**
 * A local mutation was just queued — a good moment to sync, and every
 * screen showing data should refresh *now*, not after the next sync.
 * Without the second part, a change made offline (add / edit / delete a
 * record, pay a bill) was saved but invisible until the server answered.
 */
export const emitMutation = () => {
  emit(MUTATION_EVENT)
  if (localChangeTimer) clearTimeout(localChangeTimer)
  localChangeTimer = setTimeout(() => {
    localChangeTimer = null
    emit(DATA_CHANGED_EVENT)
  }, 60)
}

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

/** The server said this device's session is no longer valid (seen during a sync). */
export const SESSION_REJECTED_EVENT = 'fico:session-rejected'
export const emitSessionRejected = () => emit(SESSION_REJECTED_EVENT)
export const onSessionRejected = (handler: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(SESSION_REJECTED_EVENT, handler)
  return () => window.removeEventListener(SESSION_REJECTED_EVENT, handler)
}
