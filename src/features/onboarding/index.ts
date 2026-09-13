/**
 * The first-open welcome prompt (WelcomeModal) and the Tutorial page it
 * links to. Deliberately per-device, not per-account — a device-local flag
 * in localStorage, the same storage tier as `fico.appearance`, since
 * "has this device seen the intro" isn't Finance data and has no reason to
 * sync or be shared with other members of a space. A different family
 * member opening Fico for the first time on their own device still gets
 * the welcome prompt even if the account itself is old.
 */

const STORAGE_KEY = 'fico.tutorialSeen'

export const hasSeenTutorial = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    // Private browsing / storage disabled — default to "seen" so a broken
    // localStorage doesn't nag on every single page load.
    return true
  }
}

export const markTutorialSeen = (): void => {
  try {
    localStorage.setItem(STORAGE_KEY, 'true')
  } catch {
    // Nothing to do — just won't be remembered next time either.
  }
}
