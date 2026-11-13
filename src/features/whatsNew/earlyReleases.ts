import type { Release } from './changelog'

/**
 * Fico before 2.0 — the early days, rebuilt from the project's history
 * (these versions weren't numbered at the time). Shown on the Updates page
 * only, never in the "What's new" pop-up.
 */
export const EARLY_RELEASES: Release[] = [
  {
    version: '1.5.0',
    date: '2026-09-20',
    title: 'Pull to refresh, and a smarter connection',
    highlights: [
      {
        icon: 'layout',
        title: 'Pull down to refresh',
        body: 'Drag the page down on your phone to check for the latest changes, just like other apps.',
      },
      {
        icon: 'wrench',
        title: 'Knows when the server is just waking up',
        body: 'Fico now tells “you’re offline” apart from “the server is still starting up”, keeps you signed in while it wakes, and syncs the moment it answers.',
      },
      {
        icon: 'wrench',
        title: 'Smoother start-up and tidier money',
        body: 'Fico opens faster with less waiting on the loading screen, and amounts across accounts and members show more consistently.',
      },
    ],
  },
  {
    version: '1.4.0',
    date: '2026-09-13',
    title: 'Make it yours',
    highlights: [
      {
        icon: 'palette',
        title: 'Settings, themes and palettes',
        body: 'A new Settings page: light or dark, font size, and a whole set of colour palettes — including BTS Army purple — plus a profile picture and notification controls.',
      },
      {
        icon: 'chart',
        title: 'Find any record',
        body: 'Records got search, filters (account, category, date, amount) and proper pages, and anything a family member added stays highlighted until you’ve seen it.',
      },
      {
        icon: 'heart',
        title: 'Report & feedback',
        body: 'Found a bug or have an idea? Send it from the menu — it goes straight to the Fico team.',
      },
      {
        icon: 'compass',
        title: 'A tour, a new look, and install',
        body: 'Real icons and buttons, a colourful navigation bar, a first-time tutorial, Terms & Privacy, a Credits page, and a proper “Install app” option. Cash check moved into a pop-up and Transfer joined Quick Add.',
      },
      {
        icon: 'receipt',
        title: 'Edit your bills',
        body: 'Change a bill’s name, amount, schedule or category any time after adding it.',
      },
    ],
  },
  {
    version: '1.3.0',
    date: '2026-09-12',
    title: 'Edit anything, and get reminded',
    highlights: [
      {
        icon: 'text',
        title: 'Fix a record after saving it',
        body: 'Edit a transaction’s title, amount, account, category, date and even time. Quick Add can backdate an entry, and you can add a category right where you pick one. Items can be weighed in kg, too.',
      },
      {
        icon: 'bell',
        title: 'Bill reminders',
        body: 'A “bills due soon” banner in the app, and real push notifications on your phone before a bill is due. Paying opens a week before the due date and shows your last payment.',
      },
      {
        icon: 'key',
        title: 'Your account, your devices',
        body: 'An Account page with your devices and optional two-step sign-in, email verification, and “Forgot password”.',
      },
      {
        icon: 'chart',
        title: 'Smarter analytics',
        body: 'Spending by bill and by family member, a starting balance that counts as real income, and no more categories showing up twice.',
      },
      {
        icon: 'palette',
        title: 'The Fico logo arrives',
        body: 'The first Fico logo, as the app icon and inside the app.',
      },
      {
        icon: 'wrench',
        title: 'Steadier',
        body: 'No more sudden reloads while you type after an update, a calmer dashboard that doesn’t flash on every refresh, and a signed-in phone is never locked out when offline.',
      },
    ],
  },
  {
    version: '1.2.0',
    date: '2026-09-11',
    title: 'Plan ahead with Budget',
    highlights: [
      {
        icon: 'wallet',
        title: 'Budget',
        body: 'Plan next month before it arrives: expected income, upcoming bills, planned expenses and weekly staples learned from how you actually shop — saved as you go.',
      },
      {
        icon: 'heart',
        title: 'Tipid tips',
        body: 'Fico sorts what you buy into needs and wants, and shows how much you could save by skipping a few wants.',
      },
      {
        icon: 'camera',
        title: 'Receipt scanning (first try)',
        body: 'Snap a receipt and Fico read it right on your phone — no cloud. (It was later paused until it reads real receipts reliably.)',
      },
      {
        icon: 'receipt',
        title: 'Itemized entries and bill fixes',
        body: 'A “batch-buying” category switches Quick Add to an item-by-item list. A mis-paid bill can be undone, a deleted bill restored, and a finished shopping trip becomes one expense instead of one per item.',
      },
    ],
  },
  {
    version: '1.1.0',
    date: '2026-09-11',
    title: 'Better together',
    highlights: [
      {
        icon: 'users',
        title: 'Family sharing',
        body: 'Share a Finance with your family. Everyone records into the same place — and any record can be kept private to just you.',
      },
      {
        icon: 'archive',
        title: 'Every device in sync',
        body: 'Changes made on one phone show up on the others. If two people change the same thing, the newest wins and both are noted, and anything that fails to sync can be retried or discarded.',
      },
      {
        icon: 'text',
        title: 'Activity and members',
        body: 'An Activity page shows who did what, and the Finance owner can manage members and hand over ownership.',
      },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-09-11',
    title: 'Hello, Fico',
    highlights: [
      {
        icon: 'layout',
        title: 'An app that works offline',
        body: 'Install Fico on your phone or computer like a normal app. Everything is saved on your device first, so it works with no connection at all.',
      },
      {
        icon: 'wallet',
        title: 'Accounts and Quick Add',
        body: 'Cash, bank and e-wallet accounts with live balances, and Quick Add to record money spent, received or moved in seconds.',
      },
      {
        icon: 'receipt',
        title: 'Shopping lists that become expenses',
        body: 'Plan a shopping trip, check items off as you buy them, and the finished trip turns into an expense. Fico remembers items and their prices for next time.',
      },
      {
        icon: 'bell',
        title: 'Bills and electricity',
        body: 'Keep track of bills and their due dates, record payments, and follow your electricity use (kWh) bill by bill.',
      },
      {
        icon: 'camera',
        title: 'Receipts and cash checks',
        body: 'Attach a receipt photo to a record, and use Cash check to compare what Fico says you have with what’s really in your wallet.',
      },
      {
        icon: 'chart',
        title: 'Analytics',
        body: 'See where your money goes by category and over time.',
      },
    ],
  },
]
