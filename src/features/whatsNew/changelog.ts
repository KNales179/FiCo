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
    version: '2.5.0',
    date: '2026-11-13',
    title: 'Fair chances, and a smoother sign-in',
    highlights: [
      {
        icon: 'heart',
        title: 'Appeal a restriction',
        body: 'If your account is ever restricted, you can now appeal it right from the sign-in screen. The team reviews it and tells you their decision — lifted, shortened, or kept — with a note.',
      },
      {
        icon: 'layout',
        title: 'A calmer sign-in on phones and tablets',
        body: 'The animated Fico logo now drifts softly behind the form, with a few icons floating around — and on bigger screens the logo panel stays put while you scroll the sign-up form.',
      },
    ],
  },
  {
    version: '2.4.0',
    date: '2026-11-13',
    title: 'Notifications, and a word from the team',
    highlights: [
      {
        icon: 'bell',
        title: 'A new Notifications page',
        body: 'Find it under the bell at the top. When the Fico team finishes something you suggested or fixes a bug you reported, you’ll hear about it here — tap it to jump straight to Updates and see what changed.',
      },
      {
        icon: 'heart',
        title: 'Messages from the Fico team',
        body: 'Every now and then the team might send you a note. It pops up the next time you open Fico and stays on your Notifications page.',
      },
      {
        icon: 'key',
        title: 'Clear answers when you’re signed out',
        body: 'If an admin ever signs you out or pauses your account, the sign-in screen now tells you why and for how long — no more mystery “session expired”.',
      },
    ],
  },
  {
    version: '2.3.2',
    date: '2026-11-13',
    title: 'Try Fico without signing up',
    highlights: [
      {
        icon: 'compass',
        title: 'A demo you can poke at',
        body: 'Tap “Try the demo” on the sign-in screen to explore all of Fico with a sample household’s money — bills, budgets, shopping lists, charts and the guided tours. Change anything you like; it stays on your device and vanishes when you exit.',
      },
    ],
  },
  {
    version: '2.3.1',
    date: '2026-11-13',
    title: 'A tidier Finance switcher',
    highlights: [
      {
        icon: 'wallet',
        title: 'Your Finances, in one tidy list',
        body: 'Tap your Finance’s name at the top to see all of them — personal and shared — and switch with one tap. “Add another Finance” now lives at the bottom of that list instead of a separate button.',
      },
      {
        icon: 'users',
        title: 'Up to 3 Finances of your own',
        body: 'Each person can own up to three Finances (your personal one included). Finances someone else shares with you don’t count toward that.',
      },
    ],
  },
  {
    version: '2.3.0',
    date: '2026-11-12',
    title: 'Hello, new look',
    highlights: [
      {
        icon: 'key',
        title: 'A sign-in screen worth the first look',
        body: 'Signing in and signing up got a glow-up: the logo draws itself, floats around and loops on the side, and moving between Sign in, Create account and Forgot password now glides instead of jumping.',
      },
      {
        icon: 'heart',
        title: 'Fico knows your birthday now (if you tell it)',
        body: 'Add your birthday and paydays in Account → About you. When you plan the month your birthday’s in, Budget suggests a little treat-yourself money — and on the day itself, Fico has a surprise for you.',
      },
      {
        icon: 'users',
        title: 'Continue with Google',
        body: 'No new password to remember — sign in or create your Fico account with your Google account in one tap. Already have an account with the same email? It just links up.',
      },
      {
        icon: 'wrench',
        title: 'Sign-up tells you what’s wrong',
        body: 'No more mystery “invalid data”. Fico now points at the exact field — a space in your username, passwords that don’t match, an email that’s already registered — and there’s a little eye to peek at your password while you type it.',
      },
      {
        icon: 'compass',
        title: 'A little hello when you open Fico',
        body: 'The logo now draws itself in and fills with colour when you open the app — it follows your colour and light/dark mode. Tap to skip if you’re in a hurry.',
      },
      {
        icon: 'palette',
        title: 'The logo matches your colour',
        body: 'Fico’s logo inside the app now follows the colour you picked in Settings — and looks right in both light and dark mode.',
      },
      {
        icon: 'layout',
        title: 'A crisp new app icon',
        body: 'The icon you tap to open Fico is now a purple tile with a white logo — sharp on every phone and computer. (Already installed? Your phone may show the old one until you reinstall.)',
      },
    ],
  },
  {
    version: '2.2.0',
    date: '2026-11-12',
    title: 'Install in a tap, lock it up tight',
    highlights: [
      {
        icon: 'layout',
        title: 'Fico, as a real app',
        body: 'Fico now offers to install itself — one tap where your browser allows it, simple steps where it doesn’t. Its own icon, its own window, works offline.',
      },
      {
        icon: 'key',
        title: 'Two-step sign-in for everyone',
        body: 'Want an extra lock? Account → Two-step sign-in. Scan a QR code with an authenticator app and you’re set. Totally optional!',
      },
      {
        icon: 'compass',
        title: 'New tour: Install & security',
        body: 'Not sure how? How Fico works → Install & security walks you through both.',
      },
    ],
  },
  {
    version: '2.1.1',
    date: '2026-11-12',
    title: 'A tidier menu',
    highlights: [
      {
        icon: 'users',
        title: 'Everything in its place',
        body: 'Your menu is now grouped: you stuff (Account, Settings, Log out), your Finance (Members, Categories, Activity), and help (tours, Updates, Credits, feedback).',
      },
    ],
  },
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
