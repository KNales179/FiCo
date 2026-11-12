/**
 * Ready-made wording for admin actions — a starting point the admin can
 * edit before sending, plus their own saved templates (kept on this
 * device). Written for the person who'll read them.
 */

export type TemplateKind =
  | 'notice'
  | 'signout'
  | 'restrict'
  | 'delete'
  | 'password'
  | 'role'
  | 'twofa'
  | 'appealLift'
  | 'appealShorten'
  | 'appealKeep'

export interface ReasonTemplate {
  id: string
  label: string
  text: string
  custom?: boolean
}

const BUILT_IN: Record<TemplateKind, ReasonTemplate[]> = {
  notice: [
    { id: 'n-maint', label: 'Maintenance', text: 'Heads-up: Fico will be under maintenance tonight, so it may be slow or offline for a little while. Your records are safe and will sync once it’s back.' },
    { id: 'n-thanks', label: 'Thank you', text: 'Thank you for using Fico and for your feedback — it really helps make the app better for everyone.' },
    { id: 'n-feedback', label: 'Need more info', text: 'Thanks for your report! Could you tell us a bit more — what you tapped, and what you expected to happen? Send it through Report & feedback.' },
    { id: 'n-warning', label: 'Friendly warning', text: 'Just a friendly reminder to keep shared Finances tidy and respectful for everyone in them. Thanks for understanding!' },
  ],
  signout: [
    { id: 's-lost', label: 'Lost device', text: 'You asked us to sign out a lost or shared device. Please sign in again on the devices you still use.' },
    { id: 's-security', label: 'Security check', text: 'We noticed unusual activity on your account, so we signed you out everywhere to be safe. Sign in again, and consider changing your password.' },
    { id: 's-update', label: 'Account update', text: 'We made a change to your account and need you to sign in again so it takes effect.' },
  ],
  restrict: [
    { id: 'r-spam', label: 'Spam', text: 'Repeatedly adding spam or junk entries in a shared Finance.' },
    { id: 'r-abuse', label: 'Harassment', text: 'Disrespectful or harassing messages toward other members.' },
    { id: 'r-security', label: 'Security', text: 'Suspicious activity on your account. We’ve paused it to keep it safe while we check.' },
    { id: 'r-misuse', label: 'Misuse', text: 'Using Fico in a way that goes against the Terms & Conditions.' },
  ],
  delete: [
    { id: 'd-request', label: 'User asked', text: 'You asked us to delete your account.' },
    { id: 'd-inactive', label: 'Inactive', text: 'This account hasn’t been used in a long time.' },
    { id: 'd-terms', label: 'Terms broken', text: 'Repeated violations of the Terms & Conditions after earlier restrictions.' },
    { id: 'd-duplicate', label: 'Duplicate', text: 'This was a duplicate of another account you use.' },
  ],
  password: [
    { id: 'p-request', label: 'You asked', text: 'You asked us to reset your password. Sign in with the new one we sent you, then change it in Account.' },
    { id: 'p-security', label: 'Security', text: 'We reset your password to keep your account safe. Ask us for the new one, or use “Forgot password” to choose your own.' },
  ],
  role: [
    { id: 'ro-welcome', label: 'Welcome admin', text: 'Welcome to the admin team! Please use these tools kindly and carefully.' },
    { id: 'ro-thanks', label: 'Thanks for helping', text: 'Thank you for helping out as an admin — your account works as before, just without the Admin page.' },
  ],
  twofa: [
    { id: 't-lost', label: 'Lost phone', text: 'You lost access to your authenticator, so we turned two-step sign-in off. Set it up again in Account when you can.' },
  ],
  appealLift: [
    { id: 'al-misunderstand', label: 'Misunderstanding', text: 'Thanks for explaining — this was a misunderstanding. Sorry for the trouble!' },
    { id: 'al-second', label: 'Second chance', text: 'We’re giving you a second chance. Please keep the Terms in mind going forward.' },
  ],
  appealShorten: [
    { id: 'as-partial', label: 'Partly agreed', text: 'We understand your side, so we’ve shortened the restriction. Thanks for being honest with us.' },
  ],
  appealKeep: [
    { id: 'ak-stands', label: 'Decision stands', text: 'We looked at it again, and the original reason still applies. The restriction will end on its own as planned.' },
    { id: 'ak-evidence', label: 'Clear evidence', text: 'The activity on your account clearly matched the reason given, so the restriction stays.' },
  ],
}

const KEY = 'fico.adminTemplates'

const readCustom = (): Partial<Record<TemplateKind, ReasonTemplate[]>> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Record<TemplateKind, ReasonTemplate[]>>
  } catch {
    return {}
  }
}

const writeCustom = (all: Partial<Record<TemplateKind, ReasonTemplate[]>>) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // Storage blocked — it just won't be remembered.
  }
}

export const templatesFor = (kind: TemplateKind): ReasonTemplate[] => [
  ...BUILT_IN[kind],
  ...(readCustom()[kind] ?? []).map((t) => ({ ...t, custom: true })),
]

export const saveTemplate = (kind: TemplateKind, text: string): void => {
  const clean = text.trim()
  if (!clean) return
  const all = readCustom()
  const list = all[kind] ?? []
  if (list.some((t) => t.text === clean)) return
  const label = clean.length > 22 ? `${clean.slice(0, 22).trim()}…` : clean
  all[kind] = [...list, { id: `c-${Date.now()}`, label, text: clean }]
  writeCustom(all)
}

export const removeTemplate = (kind: TemplateKind, id: string): void => {
  const all = readCustom()
  all[kind] = (all[kind] ?? []).filter((t) => t.id !== id)
  writeCustom(all)
}
