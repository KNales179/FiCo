/**
 * The guided tour's script. Each step points at an element marked with a
 * matching `data-tour="…"` attribute somewhere in the app. A step whose
 * target isn't on screen (a brand-new Finance with no accounts has no Quick
 * add yet; the desktop nav is hidden on a phone) is simply skipped, so the
 * same script works for every account and every screen size.
 *
 * `target: null` is a centred card with the whole screen dimmed — used for
 * the welcome and the wrap-up.
 */
export interface TourStep {
  target: string | null
  title: string
  body: string
}

export const TOUR_STEPS: TourStep[] = [
  {
    target: null,
    title: 'Welcome to Fico',
    body: "Let's take a quick look around — about a minute. Tap Next to move along, or Skip any time. You can replay this from the menu under “How Fico works”.",
  },
  {
    target: 'space',
    title: 'Your Finance',
    body: 'Everything you record lives in a Finance. Switch between your personal one and a family one here, or tap New to start another and invite people to it.',
  },
  {
    target: 'summary',
    title: 'Your money at a glance',
    body: 'The total across all your active accounts, plus what went out and came in this month — worked out from what you record.',
  },
  {
    target: 'cash-check',
    title: 'Cash check',
    body: 'Count the cash in your wallet and type it in. Fico compares it with what it expected, so you can spot anything you forgot to record.',
  },
  {
    target: 'accounts',
    title: 'Accounts',
    body: 'Every place your money sits — cash on hand, bank, e-wallet, savings. Each one keeps its own balance.',
  },
  {
    target: 'accounts-add',
    title: 'Add an account',
    body: 'Tap here, give it a name, pick the type, and type its current balance as the opening balance. Start with the cash you have on hand.',
  },
  {
    target: 'account-row',
    title: 'Account buttons',
    body: 'Star makes an account the default for Quick add. Archive hides one you no longer use but keeps its history — bring it back from “Show archived”. Delete only works on an account with no records.',
  },
  {
    target: 'quick-add',
    title: 'Quick add',
    body: 'The fastest way to record money as it happens. Everything in Fico is typed by you — it never connects to a bank or e-wallet.',
  },
  {
    target: 'quick-add-type',
    title: 'Spent, Received or Transfer',
    body: 'Pick what happened first: money you spent, money you received, or money moved between two of your accounts (like a bank withdrawal into cash).',
  },
  {
    target: 'quick-add-fields',
    title: 'Fill it in and tap Add',
    body: 'Type the amount and what it was for, pick the account and category, check the date, then tap Add. Pick a category that tracks items to list each item instead.',
  },
  {
    target: 'scan',
    title: 'Scan a receipt',
    body: 'Take or pick a photo of a receipt. It is read right on your device — nothing is uploaded — and only the parts it reads clearly get filled in for you to check.',
  },
  {
    target: 'records',
    title: 'Records',
    body: 'Every entry, newest first. Tap the eye to see details and attachments, the pencil to fix a mistake, or the bin to delete.',
  },
  {
    target: 'records-filters',
    title: 'Find anything',
    body: 'Search by title, or narrow down by account, category, date and amount. Change how many show per page on the right.',
  },
  {
    target: 'nav',
    title: 'The rest of Fico',
    body: 'Shopping turns a list into one recorded expense. Bills tracks due dates and reminds you. Budget plans the month from your own history. Analytics shows where it all went.',
  },
  {
    target: 'profile',
    title: 'Your menu',
    body: 'Settings (theme, colors, font and text size), Categories, Members, Activity — and “How Fico works” to replay this tour.',
  },
  {
    target: null,
    title: "You're all set",
    body: 'Start by adding your accounts, then record your first expense with Quick add. It works offline too — it syncs when you are back online.',
  },
]
