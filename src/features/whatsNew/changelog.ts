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
  | 'award'

export interface Release {
  version: string
  /** YYYY-MM-DD */
  date: string
  title: string
  highlights: { icon: HighlightIcon; title: string; body: string }[]
}

export const RELEASES: Release[] = [
  {
    version: '2.14.0',
    date: '2026-11-17',
    title: 'Make it yours',
    highlights: [
      {
        icon: 'palette',
        title: 'See how Fico can look',
        body: 'The front page has a new “Make it yours” section: recolour a little Fico card with a colour wheel or the suggested colours, and hover the big “Font” to roll through every font Fico has.',
      },
    ],
  },
  {
    version: '2.13.2',
    date: '2026-11-17',
    title: 'A grid that follows you',
    highlights: [
      {
        icon: 'palette',
        title: 'Grid lines light up under your mouse',
        body: 'On a computer, the background grid now glows softly in your accent colour around the mouse pointer, on the front page, the sign-in screens and in the app. It stays off on touch screens and when your device asks for less motion.',
      },
    ],
  },
  {
    version: '2.13.1',
    date: '2026-11-17',
    title: 'No more blank screen after updates',
    highlights: [
      {
        icon: 'wrench',
        title: 'Fico repairs itself after an update',
        body: 'If your device was still holding an outdated copy of Fico after an update, it could open to a blank white page. It now notices, refreshes its saved copy and reloads by itself. Your records and unsynced changes are never touched.',
      },
    ],
  },
  {
    version: '2.13.0',
    date: '2026-11-17',
    title: 'Your month on a calendar',
    highlights: [
      {
        icon: 'chart',
        title: 'A money calendar',
        body: 'New in the menu: Calendar. See paydays, bills paid and due, and what you spent or received each day of the month. Tap a day for everything on it.',
      },
      {
        icon: 'layout',
        title: 'Bigger phone and tablet on the front page',
        body: 'The device pictures on the website are larger and easier to see, and the demo household now has profile pictures.',
      },
      {
        icon: 'compass',
        title: 'The demo never signs you out',
        body: 'Trying the tours from the front page while signed in now stays in your own account, and leaving the demo always takes you back to it.',
      },
    ],
  },
  {
    version: '2.12.0',
    date: '2026-11-17',
    title: 'Fico, Your Financial Companion',
    highlights: [
      {
        icon: 'layout',
        title: 'A fuller front page',
        body: 'The website now shows Fico on a laptop, a tablet and a phone, and tells the story behind it: our purpose, mission and vision, each with its own picture.',
      },
      {
        icon: 'compass',
        title: 'Straight into the guided demo',
        body: '“Take the guided demo” on the front page opens How Fico works with sample data, and finishing a tour now brings you back to the list of tours.',
      },
      {
        icon: 'palette',
        title: 'Nothing cut off',
        body: 'The animated Fico logo on the front page and sign-in screens no longer sits in a box, so its circles show in full.',
      },
    ],
  },
  {
    version: '2.11.1',
    date: '2026-11-16',
    title: 'A quieter Activity page',
    highlights: [
      {
        icon: 'wrench',
        title: 'No more floods of category entries',
        body: 'A new phone or a new member no longer fills Activity with “resolved a conflicting edit to category” for the starter categories. Repeats already there now show once, with how many times (×12).',
      },
      {
        icon: 'receipt',
        title: 'Renamed categories stay renamed',
        body: 'Fixed a bug where renaming a starter category (say Food → Meals) could be reset back by another device. Removed items in Activity now show their real name too.',
      },
    ],
  },
  {
    version: '2.11.0',
    date: '2026-11-16',
    title: 'A front door for Fico',
    highlights: [
      {
        icon: 'layout',
        title: 'Fico has a front page',
        body: 'New visitors to the website now see what Fico is (features, how it works, why Fico and answers to common questions) with buttons to download the app or sign up. The installed app skips it and opens straight into Fico.',
      },
      {
        icon: 'compass',
        title: 'About Fico, from the menu',
        body: 'Open the front page any time from the menu without signing out. It shows “Open Fico” to bring you straight back.',
      },
      {
        icon: 'key',
        title: 'No more sign-in screen when you’re signed in',
        body: 'If you’re already signed in, the sign-in and sign-up pages take you straight to your dashboard.',
      },
      {
        icon: 'palette',
        title: 'A lighter sign-in screen',
        body: 'The panel behind the Fico logo on the sign-in and sign-up screens is now almost see-through: just a soft glow and a faint edge.',
      },
    ],
  },
  {
    version: '2.10.0',
    date: '2026-11-16',
    title: 'Activity, in tabs',
    highlights: [
      {
        icon: 'layout',
        title: 'Records, Members & roles, Sync conflicts',
        body: 'A shared Finance’s Activity page now has tabs, and Records can be narrowed to Money, Bills, To-buy lists, or Budget & categories. Everything is grouped by day.',
      },
      {
        icon: 'wallet',
        title: 'Your personal Finance has Activity too',
        body: 'See your own history in your personal Finance — what you added, changed or removed, going back up to a year. Handy when a balance looks off.',
      },
      {
        icon: 'receipt',
        title: 'See exactly what changed',
        body: 'Edits now show before and after — like “Amount: ₱120.00 → ₱150.00” — with account and category names. As before, only the owner and admins can see Activity, and private records never appear.',
      },
    ],
  },
  {
    version: '2.9.0',
    date: '2026-11-16',
    title: 'Invite-only beta',
    highlights: [
      {
        icon: 'key',
        title: 'Joining Fico now takes an invite code',
        body: 'While Fico is in beta, new accounts need a one-time invite code, which works for 1 hour. Want to help test it? Email ibelldev179@gmail.com for a beta tester code, or ask the Fico admin who invited you. Everyone who joins with a code gets the Beta tester badge.',
      },
      {
        icon: 'layout',
        title: 'A tidier Admin area',
        body: 'For Fico admins: Users, Invite codes, Appeals, and Report & feedback each have their own tab now, and admins can make, copy and cancel invite codes (each lasts 1 hour).',
      },
    ],
  },
  {
    version: '2.8.1',
    date: '2026-11-14',
    title: 'Admins can invite, and tidier switches',
    highlights: [
      {
        icon: 'layout',
        title: 'On/off switches fixed',
        body: 'The little on/off switches now sit neatly in their track and are easy to read, in both light and dark mode.',
      },
      {
        icon: 'users',
        title: 'Admins can bring people in',
        body: 'In a shared Finance, admins can now invite people and remove members and viewers. Setting roles and handing over ownership stay with the owner.',
      },
    ],
  },
  {
    version: '2.8.0',
    date: '2026-11-13',
    title: 'Shared Finances, grown up',
    highlights: [
      {
        icon: 'users',
        title: 'Roles: Owner, Admin, Member, Viewer',
        body: 'The owner of a shared Finance now picks everyone’s role on the Members page. Admins edit everything and see Activity (who changed what), Members add and edit records, and Viewers can look but not change anything. You can try it on the demo’s Members page.',
      },
      {
        icon: 'award',
        title: 'Badges and role tags on your profile',
        body: 'Your Account page shows tags like “Owner · 2” and “Admin · 1” — tap one to see which Finances. And look out for Fico badges like Beta tester.',
      },
      {
        icon: 'receipt',
        title: '“Shopping” is now “To-buy lists”',
        body: 'Same lists, clearer name — so it never looks like you can buy something inside Fico. And shared Finances are simply “Shared” now, ready for a household, a group, or a small business.',
      },
      {
        icon: 'receipt',
        title: 'A tidier Bills page',
        body: 'Your bill totals and usage charts now sit right above Paid bills — and a usage chart only appears for a kind of bill you actually pay.',
      },
      {
        icon: 'chart',
        title: 'Track water, LPG and fuel — not just kWh',
        body: 'A bill can now track water (m³ — PrimeWater, Maynilad, Manila Water), LPG (kg per refill) or fuel (litres) as well as electricity. Enter how much you used when you pay, and Bills and Analytics show cost per unit, so you can tell a price increase apart from using more.',
      },
    ],
  },
  {
    version: '2.7.0',
    date: '2026-11-13',
    title: 'Your balance, your way',
    highlights: [
      {
        icon: 'wallet',
        title: 'Pin the balance you check most',
        body: 'On the dashboard, tap “Pin a balance” and choose an account — say, On hand. Show it right next to your Total balance, or let it take the Total’s place. Each Finance remembers its own pin.',
      },
      {
        icon: 'heart',
        title: 'Point us to the exact spot',
        body: 'When you report a bug or suggest something, you can now pick which page it’s about — and then which part of that page — so the Fico team knows exactly where to look.',
      },
    ],
  },
  {
    version: '2.6.0',
    date: '2026-11-13',
    title: 'Offline, all the way',
    highlights: [
      {
        icon: 'archive',
        title: 'Syncs even after you close Fico',
        body: 'On Android, changes you made offline now upload on their own as soon as you get signal — even if Fico is closed. On iPhone, Fico sends them the moment you leave the app, and again the next time you open it.',
      },
      {
        icon: 'bell',
        title: 'You’ll hear about every change that didn’t make it',
        body: 'If the server can’t save something, or your offline edit was replaced by someone’s newer one, a notification lists exactly what it was — name, amount, Finance, and why — so nothing is lost. Notifications now open and close with a tap, too.',
      },
      {
        icon: 'users',
        title: 'Edits from two people no longer clash',
        body: 'If you change a record’s amount while someone else renames it, both changes are kept. Only edits to the very same thing go to whoever changed it last.',
      },
      {
        icon: 'wallet',
        title: 'All your Finances, ready offline',
        body: 'Every Finance you belong to now downloads in the background — and the status line tells you when it last synced, and how many changes are waiting.',
      },
    ],
  },
  {
    version: '2.5.2',
    date: '2026-11-13',
    title: 'Offline mode, properly fixed',
    highlights: [
      {
        icon: 'wrench',
        title: 'Changes show up the moment you make them',
        body: 'Offline, a record you added, edited or deleted used to stay invisible until you were back online. Now every screen updates right away — records, balances, bills, shopping and budget — and syncs later on its own.',
      },
      {
        icon: 'key',
        title: 'Your offline work is never thrown away',
        body: 'If your sign-in expires while you’re offline, everything you recorded is kept and sent up as soon as you sign back in. And logging out with unsynced changes now asks first instead of deleting them.',
      },
      {
        icon: 'archive',
        title: 'Fewer “sync failed” surprises',
        body: 'Checking off shopping items now syncs (it was being refused). Changes in every Finance sync — not just the one that’s open — one bad change no longer blocks the rest, and anything that was stuck gets another try.',
      },
      {
        icon: 'camera',
        title: 'Receipt photos actually upload now',
        body: 'Photos you attach to a record go up to the server, so everyone in the Finance can see them. Attaching needs a connection — offline, the button tells you so. Scanned receipts still work offline and their photo uploads once you’re back online.',
      },
    ],
  },
  {
    version: '2.5.1',
    date: '2026-11-13',
    title: 'Edit your weekly staples',
    highlights: [
      {
        icon: 'wallet',
        title: 'Tweak a staple without starting over',
        body: 'On the Budget page, each weekly staple (and each planned expense) now has an “edit” button — change its name or amount right where it is, no more removing and re-adding.',
      },
    ],
  },
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
