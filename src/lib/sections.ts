export const OPEN_SECTION_EVENT = 'fico:open-section'

/** Opens a folded CollapsibleCard from elsewhere (e.g. before scrolling into it). */
export const openSection = (id: string) =>
  window.dispatchEvent(new CustomEvent(OPEN_SECTION_EVENT, { detail: id }))
