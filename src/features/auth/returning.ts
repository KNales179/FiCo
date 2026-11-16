/**
 * Has this browser ever been signed in to Fico? The website's front page is
 * for first-time visitors; someone who has used Fico here before (and was
 * signed out, on purpose or not) goes straight to signing in, where any
 * "your changes were kept" or "you were signed out because…" message waits.
 */
const KEY = 'fico.hasSignedIn'

export const markSignedIn = () => {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // private mode: the front page will just show again, which is harmless
  }
}

export const hasSignedInBefore = (): boolean => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}
