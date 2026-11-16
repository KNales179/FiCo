/**
 * Every page of Fico and its named sections — for tagging a bug report or
 * suggestion with exactly where it's about. Section names match what the
 * pages show. Keep in step when a page gains or renames a section.
 */
export interface AppPage {
  name: string
  sections: string[]
  /** Only offered to admins. */
  adminOnly?: boolean
}

export const APP_PAGES: AppPage[] = [
  {
    name: 'Dashboard',
    sections: ['Balance (top card)', 'Pinned balance', 'Cash check', 'Insights', 'Quick add', 'Accounts', 'Records'],
  },
  { name: 'To-buy lists', sections: ['Your lists', 'Items in a list', 'Finishing a list', 'To-buy spend · last 6 months'] },
  {
    name: 'Bills',
    sections: ['Upcoming', 'Paid bills', 'All bills', 'Adding or editing a bill', 'Paying a bill', 'Overview', 'Usage (electricity, water, LPG, fuel)', 'Archived bills', 'Deleted bills'],
  },
  {
    name: 'Budget',
    sections: [
      'Expected income',
      'Bills',
      'Other planned expenses',
      'Weekly staples',
      'Birthday treat',
      'Where the money goes (chart)',
      'The breakdown',
      'Tipid tips',
      'Money in vs out · last 6 months',
    ],
  },
  { name: 'Analytics', sections: ['Spending by category', 'Biggest categories', 'Spending over time', 'Usage (electricity, water, LPG, fuel)'] },
  { name: 'Calendar', sections: ['Month grid', 'Day details', 'Month totals', 'Paydays'] },
  { name: 'Categories', sections: ['Category list', 'Adding a category', 'Renaming or deleting'] },
  { name: 'Members', sections: ['Member list', 'Roles (Owner, Admin, Member, Viewer)', 'Invite someone', 'Pending invitations', 'Leaving a Finance'] },
  { name: 'Activity', sections: ['Records tab', 'Members & roles tab', 'Sync conflicts tab', 'What changed (before → after)'] },
  {
    name: 'Account',
    sections: ['Profile picture & header', 'Badges & role tags', 'Your details', 'About you', 'Change password', 'Two-step sign-in (2FA)', 'Your devices', 'Install Fico as an app'],
  },
  {
    name: 'Settings',
    sections: ['Theme', 'Colour', 'Font', 'Text size', 'Row spacing', 'Records shown per page', 'Your currency', 'Notifications'],
  },
  { name: 'Notifications', sections: ['Notification list', 'Pop-up messages', 'The bell'] },
  { name: 'Updates', sections: ['Release notes', '“What’s new” pop-up'] },
  { name: 'How Fico works', sections: ['Guided tours', 'Tutorial page'] },
  { name: 'Report & feedback', sections: ['This form'] },
  { name: 'Front page (website)', sections: ['Top bar', 'Download / Sign up buttons', 'Features', 'Make it yours (colour & font)', 'How it works', 'Why Fico', 'FAQ', 'Footer'] },
  { name: 'Sign in & sign up', sections: ['Sign in', 'Create account', 'Invite code', 'Forgot / reset password', 'Try the demo'] },
  { name: 'Finance switcher', sections: ['Switching Finances', 'Adding a Finance'] },
  { name: 'Sync & offline', sections: ['Sync status line', 'Offline use', 'Changes that couldn’t sync'] },
  { name: 'Menu & navigation', sections: ['Top bar', 'Bottom bar (phone)', 'Menu'] },
  { name: 'Admin', sections: ['Admin tabs', 'User list', 'User profile', 'Invite codes', 'Appeals', 'Report & feedback list'], adminOnly: true },
  { name: 'Something else', sections: [] },
]
