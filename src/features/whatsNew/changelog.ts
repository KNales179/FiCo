/**
 * Release notes. The newest entry is the app's current version: it's shown
 * as plain text in the footer and, once per device, as the "What's new"
 * pop-up after an update. Add a new entry at the top for every release —
 * that's the whole process.
 */

export type HighlightIcon =
  | 'palette'
  | 'layout'
  | 'chart'
  | 'compass'
  | 'receipt'
  | 'archive'
  | 'moon'
  | 'wrench'
  | 'camera'
  | 'bell'
  | 'heart'
  | 'key'
  | 'wallet'
  | 'text'
  | 'users'

export interface Release {
  version: string
  /** YYYY-MM-DD */
  date: string
  title: string
  highlights: { icon: HighlightIcon; title: string; body: string }[]
}

export const RELEASES: Release[] = [
  {
    version: '2.1.0',
    date: '2026-11-12',
    title: 'Tidy, cozy, and stays logged in',
    highlights: [
      {
        icon: 'layout',
        title: 'Fold it your way',
        body: 'Tap any section’s name to fold it away — Fico remembers what you like open. Less scrolling, more you.',
      },
      {
        icon: 'wallet',
        title: 'Your money, your currency',
        body: 'Living abroad? Settings → Currency lets you see amounts in AED, USD or whatever you think in — just for you, nobody else’s view changes.',
      },
      {
        icon: 'text',
        title: 'Settings, but make it neat',
        body: 'Settings is now split into tidy tabs, with 14 fonts to pick from — professional, cute, and yes, a few silly ones.',
      },
      {
        icon: 'receipt',
        title: 'Bills got a glow-up',
        body: '“Add bill” now hides behind a button until you need it, and the long Paid bills list moved to the side where it belongs.',
      },
      {
        icon: 'palette',
        title: 'Easier on the eyes',
        body: 'Light mode is softer now, and your favourite colour actually shows up in the background. No more blinding white!',
      },
      {
        icon: 'key',
        title: 'No more surprise logouts',
        body: 'As long as you keep using Fico, you stay signed in — even while the server is still waking up.',
      },
      {
        icon: 'bell',
        title: 'Reminders, one tap away',
        body: 'Fico will now and then offer to turn on notifications, so you never miss a bill again — and the on/off switch finally lives in Settings → Notifications.',
      },
      {
        icon: 'compass',
        title: 'More tours, more answers',
        body: 'New Members tour (inviting and managing family), shopping tour now explains shared lists, and Menu → Updates lists every version Fico has had.',
      },
      {
        icon: 'heart',
        title: 'Psst… support Fico',
        body: 'Curious why going online takes a moment? Peek at Credits — and if Fico helps you, there’s a way to say thanks.',
      },
    ],
  },
  {
    version: '2.0.0',
    date: '2026-11-12',
    title: 'A brand-new Fico',
    highlights: [
      {
        icon: 'palette',
        title: 'A fresh new look',
        body: 'New cards, page headers, a soft grid behind everything, and smooth animations. Pick your font in Settings — Jakarta, Inter, Manrope, Nunito or your device’s own.',
      },
      {
        icon: 'moon',
        title: 'Light and dark in one tap',
        body: 'The new sun/moon button in the top bar switches themes with a circle reveal. Settings → Theme → System follows your device again.',
      },
      {
        icon: 'layout',
        title: 'Made for every screen',
        body: 'Tablets get the bottom bar like phones, and wider layouts. On a laptop the dashboard keeps your balance, Quick add and accounts on the left while Records scrolls on the right.',
      },
      {
        icon: 'chart',
        title: 'Charts everywhere',
        body: 'Spending over the last two weeks and top categories on the dashboard, plus charts on Bills, Budget and Shopping. Analytics is rebuilt with real graphs — hover or tap any bar for the exact amount.',
      },
      {
        icon: 'receipt',
        title: 'Clearer Bills',
        body: 'Upcoming now shows only what still needs paying (a paid bill stays 3 days with a “Paid” tag). Every payment lives in the new Paid bills list — tap “Paid” or any payment in a bill’s history to jump right to it. Bill payments also stand out in your Records.',
      },
      {
        icon: 'archive',
        title: 'Archive and bring back',
        body: 'Accounts, bills and finished shopping lists can be archived and restored any time from their own archive lists.',
      },
      {
        icon: 'compass',
        title: 'Guided tours',
        body: 'Menu → How Fico works has a tour for each page. The screen dims, a spotlight points at each part, and sample data fills in so you can see how it all works — none of it is saved.',
      },
      {
        icon: 'wrench',
        title: 'Fixes',
        body: 'Quick add has a cleaner layout. The page no longer slides sideways on phones (Bills, Members). Month totals now count every record, not just the latest 50.',
      },
      {
        icon: 'camera',
        title: 'Receipt scanning is paused',
        body: 'Scan a receipt was misreading real receipts, so it’s switched off for now until it reads them reliably.',
      },
    ],
  },
]

export const CURRENT_RELEASE = RELEASES[0]
export const APP_VERSION = CURRENT_RELEASE.version

const SEEN_KEY = 'fico.seenVersion'

/** The version this device last saw the notes for (null on a fresh device). */
export const seenVersion = (): string | null => {
  try {
    return localStorage.getItem(SEEN_KEY)
  } catch {
    return APP_VERSION // storage blocked — don't nag every load
  }
}

/**
 * Every release this device hasn't seen yet, newest first — so skipping
 * versions (updating twice between visits) still shows everything in one
 * pop-up instead of only the latest. A device that never saw any notes
 * gets them all.
 */
export const unseenReleases = (): Release[] => {
  const seen = seenVersion()
  if (seen === APP_VERSION) return []
  const index = seen ? RELEASES.findIndex((r) => r.version === seen) : -1
  return index === -1 ? RELEASES : RELEASES.slice(0, index)
}

export const markVersionSeen = (): void => {
  try {
    localStorage.setItem(SEEN_KEY, APP_VERSION)
  } catch {
    // nothing to do
  }
}
