import type { ComponentType } from 'react'
import {
  IconCalendar,
  IconCart,
  IconChart,
  IconHome,
  IconReceipt,
  IconLock,
  IconSettings,
  IconUsers,
  type IconProps,
} from '../icons'

/**
 * The guided tours' scripts. Each step points at an element marked with a
 * matching `data-tour="…"` attribute. A step whose target isn't on screen
 * (the desktop nav is hidden on a phone, the Electricity card only exists
 * when there's a reading) is simply skipped, so one script works for every
 * screen size. `target: null` is a centred card over a fully dimmed screen.
 */
export interface TourStep {
  target: string | null
  title: string
  body: string
}

export interface Tour {
  id: string
  title: string
  description: string
  icon: ComponentType<IconProps>
  /** The page this tour walks through. */
  route: string
  /** A target that only exists once the page has finished loading. */
  ready: string
  /** Run it over the temporary Sample Finance, so a new account isn't just empty states. */
  demo: boolean
  steps: TourStep[]
}

const sampleNote =
  'Everything you see during this tour is sample data — it is not yours, it is not saved, and it disappears when the tour ends.'

export const TOURS: Tour[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'Your balance, recording money, accounts, charts and records.',
    icon: IconHome,
    route: '/',
    ready: 'summary',
    demo: true,
    steps: [
      { target: null, title: 'Welcome to Fico', body: `A quick look around your dashboard. Tap Next to move along, or Skip any time. ${sampleNote}` },
      { target: 'space', title: 'Your Finance', body: 'Everything you record lives in a Finance. Tap here to switch between your personal one and a shared one — or pick “Add another Finance” at the bottom of the list (up to 3 of your own) and invite people to it.' },
      { target: 'summary', title: 'Your money at a glance', body: 'The total across all your active accounts, plus what went out and came in this month — worked out from what you record.' },
      { target: 'cash-check', title: 'Cash check', body: 'Count the cash in your wallet and type it in. Fico compares it with what it expected, so you can spot anything you forgot to record.' },
      { target: 'quick-add', title: 'Quick add', body: 'The fastest way to record money as it happens. Everything in Fico is typed by you — it never connects to a bank or e-wallet.' },
      { target: 'quick-add-type', title: 'Spent, Received or Transfer', body: 'Pick what happened first: money you spent, money you received, or money moved between two of your accounts (like an ATM withdrawal into cash).' },
      { target: 'quick-add-fields', title: 'Fill it in and tap Add', body: 'Type the amount and what it was for, pick the account and category, check the date, then tap Add.' },
      { target: 'accounts', title: 'Accounts', body: 'Every place your money sits — cash on hand, bank, e-wallet, savings. Each one keeps its own balance.' },
      { target: 'accounts-add', title: 'Add an account', body: 'Tap here, give it a name, pick the type, and type its current balance. Start with the cash you have on hand.' },
      { target: 'account-row', title: 'Account buttons', body: 'Star makes an account the default for Quick add. Archive hides one you no longer use but keeps its history — bring it back from “Show archived”. Delete only works on an account with no records.' },
      { target: 'insights', title: 'Insights', body: 'Your spending day by day for the last two weeks, and which categories took the most this month. Hover or tap a bar to see the exact amount. Tip: tap any section’s name (like “Insights”) to fold it away.' },
      { target: 'records', title: 'Records', body: 'Every entry, newest first. Tap the eye to see details, the pencil to fix a mistake, or the bin to delete.' },
      { target: 'records-filters', title: 'Find anything', body: 'Search by title, or narrow down by account, category, date and amount.' },
      { target: 'nav', title: 'The rest of Fico', body: 'Shopping turns a list into one recorded expense. Bills tracks due dates. Budget plans the month. Analytics shows where it all went. Each has its own tour in “How Fico works”.' },
      { target: 'theme-toggle', title: 'Light or dark', body: 'Switch between light and dark here. Settings → Theme → System goes back to following your device.' },
      { target: 'profile', title: 'Your menu', body: 'Settings, Categories, Members, Activity — and “How Fico works” to replay this or take another tour.' },
      { target: null, title: "You're all set", body: 'The sample data is about to disappear. Start by adding your own accounts, then record your first expense with Quick add — it works offline too.' },
    ],
  },
  {
    id: 'shopping',
    title: 'Shopping',
    description: 'Plan a trip, price items at the store, record it as one expense.',
    icon: IconCart,
    route: '/shopping',
    ready: 'shopping-chips',
    demo: true,
    steps: [
      { target: null, title: 'Shopping lists', body: `Plan what to buy at home, check things off at the store, and Fico records the whole trip as one expense. ${sampleNote}` },
      { target: 'shopping-new', title: 'Start a list', body: 'Give it a name like “Weekly groceries”. A budget is optional — if you set one, Fico shows how much of it is left as you shop. Private keeps it to just you.' },
      { target: 'shopping-chips', title: 'Your lists', body: 'Every open list sits here. Tap one to open it. Finished and cancelled ones can be archived to keep this row tidy.' },
      { target: null, title: 'Shared with your family', body: 'In a shared (family) Finance, shopping lists are shared too: everyone in it can see a list, add items, tick things off and complete the trip — handy when one person plans and another shops. Tick “Private” when you create a list to keep it just for you.' },
      { target: 'shopping-items', title: 'Items', body: 'Add items with a planned price. At the store, tick each one and type what it actually cost. Fico remembers prices, so next time it suggests the last one.' },
      { target: 'shopping-complete', title: 'Done shopping?', body: 'Pick which account paid and tap Complete shopping. The trip becomes one recorded expense, itemized — editing the list later never changes what was recorded.' },
      { target: 'shopping-trend', title: 'Shopping over time', body: 'What your trips actually cost, month by month.' },
      { target: null, title: 'That’s Shopping', body: 'The sample lists disappear when you close this. Make your first list from “New shopping list”.' },
    ],
  },
  {
    id: 'bills',
    title: 'Bills',
    description: 'Due dates, paying a bill, archiving and electricity tracking.',
    icon: IconReceipt,
    route: '/bills',
    ready: 'bills-upcoming',
    demo: true,
    steps: [
      { target: null, title: 'Bills', body: `Add a bill once and Fico tracks when it's due, reminds you, and keeps every payment. ${sampleNote}` },
      { target: 'bills-upcoming', title: 'Upcoming', body: 'Only bills that still need paying. When one opens (the week before it’s due), type the amount, pick the account and tap Pay. A paid bill stays here for 3 days with a green “Paid” tag — tap it to jump to the payment. Bills with no fixed date sit at the bottom.' },
      { target: 'bills-all', title: 'All bills', body: 'Every active bill: how often, next due date and expected amount. Open “Payment history” and tap any payment to jump to its details.' },
      { target: 'bill-actions', title: 'Bill buttons', body: 'Edit (name, dates, category), archive (it stops showing as upcoming but keeps its history — restore it any time), or delete.' },
      { target: 'bills-paid', title: 'Paid bills', body: 'Every payment in one place — which bill, how much, when and from which account. Delete a wrong payment here; that also removes its expense and moves the due date back.' },
      { target: 'bills-overview', title: 'Overview', body: 'What’s due in the next 30 days, what you have already paid this month, and six months of bill payments.' },
      { target: 'bills-electricity', title: 'Electricity', body: 'Turn on “Track kWh” for your electric bill and record usage when you pay — then you can tell a rate increase apart from using more.' },
      { target: 'bills-add', title: 'Add a bill', body: 'Tap here to open the form: monthly, yearly, specific dates (like tuition), or no fixed date (like an LPG refill) — and whether the amount stays the same or changes. Tip: tap any section’s name to fold it away.' },
      { target: null, title: 'That’s Bills', body: 'The sample bills disappear when you close this. Add your real ones from “Add a bill”.' },
    ],
  },
  {
    id: 'budget',
    title: 'Budget',
    description: 'Plan next month from your own history.',
    icon: IconCalendar,
    route: '/budget',
    ready: 'budget-plan',
    demo: true,
    steps: [
      { target: null, title: 'Budget', body: `Plan where next month's money goes before it arrives — recommended from what you actually recorded, never a guess. ${sampleNote}` },
      { target: 'budget-period', title: 'Pick the month', body: 'Plans are per month. Use the arrows to plan ahead or look back.' },
      { target: 'budget-plan', title: 'Your plan', body: 'Expected income (recommended from your recent income), the bills due that month, one-off planned expenses, and weekly staples like groceries. Everything saves as you change it.' },
      { target: 'budget-chart', title: 'Where it goes', body: 'How the income splits between bills, planned expenses, weekly staples and what’s left over. Hover a slice for the amount.' },
      { target: 'budget-breakdown', title: 'The breakdown', body: 'The same plan in numbers — including how much you can spend each week. If it comes up short, Fico tells you by how much.' },
      { target: 'budget-history', title: 'Your history', body: 'What actually came in and went out over the last six months — the history the plan is recommended from.' },
      { target: null, title: 'That’s Budget', body: 'The sample plan disappears when you close this. Your own plan fills in as you record income and spending.' },
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics',
    description: 'Charts of where your money came from and went.',
    icon: IconChart,
    route: '/analytics',
    ready: 'analytics-totals',
    demo: true,
    steps: [
      { target: null, title: 'Analytics', body: `Charts of your money over any period. ${sampleNote}` },
      { target: 'analytics-period', title: 'Pick a period', body: 'This month, last month, this year, last year, or all time.' },
      { target: 'analytics-totals', title: 'The totals', body: 'Income, expenses, what’s left (net), and how much went to bills.' },
      { target: 'analytics-trend', title: 'Over time', body: 'Day by day for a month — with a running total — or income vs expenses month by month for longer periods. Hover or tap for exact amounts.' },
      { target: 'analytics-categories', title: 'By category', body: 'What share each category took. Each category keeps its own colour, so switching periods never repaints it.' },
      { target: null, title: 'That’s Analytics', body: 'The sample charts disappear when you close this. Yours fill in as you record.' },
    ],
  },
  {
    id: 'members',
    title: 'Members',
    description: 'Invite family, manage who’s in, and what’s shared.',
    icon: IconUsers,
    route: '/members',
    ready: 'space',
    demo: false,
    steps: [
      { target: null, title: 'Share a Finance', body: 'A personal Finance is just you. A shared (family) Finance is one everyone in it can see and record into — great for household money.' },
      { target: 'space', title: 'Pick or create a Finance', body: 'Members belong to one Finance. Open this list and pick “Add another Finance” to create a shared one, then switch to it here before inviting people.' },
      { target: 'members-invite', title: 'Invite someone', body: 'Type their email and tap Invite. If they already use Fico they join right away; if not, they join automatically when they sign up with that email. Only the owner can invite.' },
      { target: 'members-list', title: 'Who’s in', body: 'Everyone in this Finance. The owner can hand over ownership (the award button) or remove someone (X). Removing someone stops their access — what they already recorded stays.' },
      { target: 'members-leave', title: 'Leaving', body: 'Not the owner? You can leave a shared Finance here any time.' },
      { target: null, title: 'What’s shared', body: 'Records, bills and shopping lists in a shared Finance are visible to everyone in it — unless you mark something Private. The Finance’s currency is in Settings → Currency, and each person can also pick their own currency to view amounts in.' },
    ],
  },
  {
    id: 'account',
    title: 'Install & security',
    description: 'Put Fico on your home screen, and the optional two-step sign-in.',
    icon: IconLock,
    route: '/account',
    ready: 'account-install',
    demo: false,
    steps: [
      { target: null, title: 'Your account', body: 'Two handy things live here: installing Fico as a real app, and an optional extra lock for your account.' },
      { target: 'account-install', title: 'Install Fico', body: 'Where your browser allows it, the Install button does it in one tap. Otherwise follow the steps shown for your browser — on a computer with Chrome it’s ⋮ → Cast, save, and share → Install page as app. Fico then gets its own icon and window, and works offline.' },
      { target: 'account-2fa', title: 'Two-step sign-in (optional)', body: 'Want extra protection? Turn this on, scan the QR code with an authenticator app (Google Authenticator, Microsoft Authenticator or Authy), and type the 6-digit code. From then on, signing in asks for your password and a code from your phone.' },
      { target: null, title: 'Keep your backup codes', body: 'When you turn it on you get backup codes — save them (Copy or Download). If you lose your phone, a backup code gets you in. Lost both? The Fico admin can turn two-step sign-in off for you. Not comfortable with authenticator apps? Simply leave it off — it’s optional.' },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'Theme, colours, fonts, your currency and notifications.',
    icon: IconSettings,
    route: '/settings',
    ready: 'settings-tabs',
    demo: false,
    steps: [
      { target: null, title: 'Make it yours', body: 'Most of these are saved on this device only, so each person in your Finance can pick their own.' },
      { target: 'settings-tabs', title: 'Four sections', body: 'Look (light or dark, and your colour), Text (font, size, spacing), Currency (your own view, and the Finance’s), and Notifications.' },
      { target: 'settings-appearance', title: 'Look', body: 'Pick light, dark or follow your device, and one of 15 accent colours — it tints the whole app.' },
      { target: 'theme-toggle', title: 'Quick switch', body: 'This button flips between light and dark from anywhere in the app.' },
      { target: null, title: 'Currency and notifications', body: 'Under Currency you can see amounts in your own currency (only you see it). Under Notifications, turn on reminders for this device and choose what Fico tells you about.' },
    ],
  },
]

export const findTour = (id: string) => TOURS.find((t) => t.id === id)
