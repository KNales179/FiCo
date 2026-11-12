const KEY = 'fico.promptShownThisVisit'

/**
 * Only one "nudge" card per visit (install Fico / turn on notifications),
 * so they never stack on top of each other. The first to ask gets it.
 */
export const claimPromptSlot = (): boolean => {
  try {
    if (sessionStorage.getItem(KEY)) return false
    sessionStorage.setItem(KEY, '1')
    return true
  } catch {
    return true
  }
}
