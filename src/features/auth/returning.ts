/**
 * The main address shows the front page to anyone signed out in a browser.
 * The one exception is right after being signed out (by choice, or because
 * the session ended): then the sign-in screen comes up, where messages like
 * "your changes were kept" or "you were signed out because…" are waiting.
 * The sign-in screen clears this once it has shown.
 */
const KEY = 'fico.justSignedOut'

export const markJustSignedOut = () => {
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    // private mode: they'd see the front page, with Sign in one tap away
  }
}

export const justSignedOut = (): boolean => {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export const clearJustSignedOut = () => {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
