/**
 * Step-by-step "install Fico as an app" instructions for the browser the
 * person is actually using — the fallback for whenever the browser won't
 * let Fico show its own one-tap Install button (Safari, Firefox, or Chrome
 * after someone dismissed its install box).
 */

export type BrowserKind =
  | 'ios'
  | 'mac-safari'
  | 'android-chrome'
  | 'android-samsung'
  | 'android-firefox'
  | 'desktop-chrome'
  | 'desktop-edge'
  | 'desktop-firefox'
  | 'other'

export const detectBrowser = (ua = typeof navigator === 'undefined' ? '' : navigator.userAgent): BrowserKind => {
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document)
  if (isIOS) return 'ios'
  const android = /Android/.test(ua)
  if (android && /SamsungBrowser/.test(ua)) return 'android-samsung'
  if (android && /Firefox/.test(ua)) return 'android-firefox'
  if (android) return 'android-chrome'
  if (/Edg\//.test(ua)) return 'desktop-edge'
  if (/Firefox/.test(ua)) return 'desktop-firefox'
  if (/Chrome\//.test(ua)) return 'desktop-chrome'
  if (/Safari/.test(ua) && /Macintosh/.test(ua)) return 'mac-safari'
  return 'other'
}

export interface InstallGuide {
  /** Where these steps apply, e.g. "Chrome on a computer". */
  where: string
  steps: string[]
  /** Set when this browser can't install apps at all. */
  unsupported?: boolean
}

export const installGuideFor = (kind: BrowserKind): InstallGuide => {
  switch (kind) {
    case 'ios':
      return {
        where: 'iPhone or iPad',
        steps: [
          'Tap the Share button (the square with an arrow pointing up).',
          'Scroll down and tap “Add to Home Screen”.',
          'Tap “Add”. Fico now opens from its own icon on your home screen.',
        ],
      }
    case 'mac-safari':
      return {
        where: 'Safari on a Mac',
        steps: ['In the menu bar, click File → “Add to Dock”.', 'Click “Add”. Fico opens from your Dock like any app.'],
      }
    case 'android-chrome':
      return {
        where: 'Chrome on Android',
        steps: [
          'Tap the ⋮ menu (top right).',
          'Tap “Add to Home screen” (or “Install app”).',
          'Tap “Install”. Fico appears on your home screen and in your app list.',
        ],
      }
    case 'android-samsung':
      return {
        where: 'Samsung Internet',
        steps: ['Tap the ≡ menu (bottom right).', 'Tap “Add page to” → “Home screen”.', 'Tap “Add”.'],
      }
    case 'android-firefox':
      return {
        where: 'Firefox on Android',
        steps: ['Tap the ⋮ menu.', 'Tap “Install” (or “Add to Home screen”).', 'Tap “Add”.'],
      }
    case 'desktop-chrome':
      return {
        where: 'Chrome on a computer',
        steps: [
          'Click the ⋮ menu (top right of Chrome).',
          'Point to “Cast, save, and share”.',
          'Click “Install page as app…” — or “Create shortcut…” and tick “Open as window”.',
          'Click “Install” (or “Create”). Fico gets its own window and desktop icon.',
        ],
      }
    case 'desktop-edge':
      return {
        where: 'Edge on a computer',
        steps: [
          'Click the … menu (top right of Edge).',
          'Point to “Apps”.',
          'Click “Install this site as an app”, then “Install”.',
        ],
      }
    case 'desktop-firefox':
      return {
        where: 'Firefox on a computer',
        unsupported: true,
        steps: [
          'Firefox on a computer can’t install web apps. Open Fico in Chrome or Edge to install it — you’ll stay signed in there separately.',
        ],
      }
    default:
      return {
        where: 'your browser',
        steps: [
          'Open your browser’s menu.',
          'Look for “Install app”, “Add to Home screen” or “Install this site as an app”.',
        ],
      }
  }
}
