/**
 * "That worked": draws a small circle-and-check next to a card's title
 * (CollapsibleCard listens for its own id). Call after an action succeeds,
 * e.g. celebrate('dash.quickadd') once a record is added.
 */
export const CELEBRATE_EVENT = 'fico:celebrate'

export const celebrate = (cardId: string) => {
  window.dispatchEvent(new CustomEvent<string>(CELEBRATE_EVENT, { detail: cardId }))
}
