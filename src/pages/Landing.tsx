import { useEffect, useState, type ComponentType, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import FicoLogo from '../components/FicoLogo'
import ThemeToggle from '../components/ThemeToggle'
import AuthShowcase from '../components/auth/AuthShowcase'
import {
  installPlatform,
  onInstallAvailabilityChange,
  promptInstall,
  type InstallPlatform,
} from '../features/pwa/installPrompt'
import {
  IconCart,
  IconChart,
  IconCheck,
  IconChevronDown,
  IconCloudOff,
  IconCompass,
  IconDownload,
  IconLock,
  IconMail,
  IconReceipt,
  IconShare,
  IconUsers,
  type IconProps,
} from '../components/icons'

/** Where questions and beta requests go (the same address as Credits and sign-up). */
const CONTACT_EMAIL = 'ibelldev179@gmail.com'

const NAV = [
  { href: '#features', label: 'Features' },
  { href: '#how', label: 'How it works' },
  { href: '#why', label: 'Why Fico' },
  { href: '#faq', label: 'FAQ' },
]

const FEATURES: Array<{ icon: ComponentType<IconProps>; title: string; body: string }> = [
  {
    icon: IconUsers,
    title: 'Shared Finances',
    body: 'Track money with family, housemates or a small team. Everyone sees the same numbers, with roles for who can change what.',
  },
  {
    icon: IconReceipt,
    title: 'Bills that remind you',
    body: 'Due dates, payment history and reminders, plus usage tracking for electricity, water, gas and fuel, so you can see what really went up.',
  },
  {
    icon: IconCart,
    title: 'To-buy lists',
    body: 'Plan the shopping run together, tick things off as you go, and the total lands in your records when you’re done.',
  },
  {
    icon: IconChart,
    title: 'Budget & insights',
    body: 'See where the money goes by category and month, and plan ahead with a budget built from your real income and bills.',
  },
  {
    icon: IconCloudOff,
    title: 'Works offline',
    body: 'No signal? Keep adding and editing. Fico saves everything on your device and syncs the moment you’re back online.',
  },
  {
    icon: IconLock,
    title: 'Private by design',
    body: 'No bank connections, no ads, no tracking. You type in what you want to keep, and private records stay yours alone.',
  },
]

const STEPS = [
  { title: 'Make a Finance', body: 'One for yourself, and shared ones for the people you split costs with.' },
  { title: 'Type it in', body: 'Add what you spend and earn in seconds: amount, what for, done.' },
  { title: 'Stay on the same page', body: 'Everyone sees the same balances, bills and lists, on any device.' },
]

const FAQ: Array<{ q: string; a: ReactNode }> = [
  {
    q: 'Is Fico connected to my bank?',
    a: 'No, and on purpose. Fico never connects to banks, e-wallets or cards. You type in what you want to track, so nothing about your accounts ever leaves your hands.',
  },
  {
    q: 'Does it work without internet?',
    a: 'Yes. Everything is saved on your device first and synced to your other devices and your shared Finances when you’re back online.',
  },
  {
    q: 'How much does it cost?',
    a: 'Fico is free while it’s in beta. Everyday money tracking will always have a free version.',
  },
  {
    q: 'How do I get an account?',
    a: (
      <>
        Fico is invite-only during the beta. Ask the person who invited you for a code, or email{' '}
        <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Fico beta tester code')}`} className="font-medium text-brand underline">
          {CONTACT_EMAIL}
        </a>{' '}
        to ask for a beta tester code.
      </>
    ),
  },
  {
    q: 'Which currencies does it support?',
    a: 'Many, including PHP, USD, EUR, GBP, AED and more. Each Finance has its own currency, and accounts can use others.',
  },
]

/** "Download the app": the browser's own install dialog, or how to do it on an iPhone. */
const useInstall = () => {
  const [platform, setPlatform] = useState<InstallPlatform>(() => installPlatform())
  useEffect(() => onInstallAvailabilityChange(() => setPlatform(installPlatform())), [])
  return platform
}

const InstallHelp = ({ platform }: { platform: InstallPlatform }) =>
  platform === 'ios-manual' ? (
    <p className="flex items-start gap-2 text-sm text-muted">
      <IconShare size={16} className="mt-0.5 shrink-0 text-brand" />
      <span>
        On iPhone or iPad: tap <span className="font-medium text-ink">Share</span>, then{' '}
        <span className="font-medium text-ink">Add to Home Screen</span>.
      </span>
    </p>
  ) : (
    <p className="text-sm text-muted">
      Open Fico in <span className="font-medium text-ink">Chrome</span> or <span className="font-medium text-ink">Edge</span> to
      install it, or on iPhone use Safari → Share → Add to Home Screen. You can also just use it right here in your browser.
    </p>
  )

/** Download + Sign up, with the install help and the demo link under them. */
const Actions = ({
  center = false,
  onDownload,
  helpOpen,
  platform,
  onDemo,
  demoBusy,
  signedIn,
}: {
  signedIn: boolean
  center?: boolean
  onDownload: () => void
  helpOpen: boolean
  platform: InstallPlatform
  onDemo: () => void
  demoBusy: boolean
}) => (
  <div className={`flex flex-col gap-3 ${center ? 'items-center' : 'items-center sm:items-start'}`}>
    <div className={`flex flex-wrap gap-3 ${center ? 'justify-center' : 'justify-center sm:justify-start'}`}>
      <button type="button" onClick={onDownload} className="btn btn-primary px-5 py-2.5 text-base">
        <IconDownload size={18} />
        Download the app
      </button>
      {signedIn ? (
        <Link to="/" className="btn px-5 py-2.5 text-base">
          Open Fico
        </Link>
      ) : (
        <Link to="/register" className="btn px-5 py-2.5 text-base">
          Sign up
        </Link>
      )}
    </div>
    {helpOpen && (
      <div className="max-w-md rounded-xl border border-line bg-panel px-4 py-3">
        <InstallHelp platform={platform} />
      </div>
    )}
    {!signedIn && (
    <button
      type="button"
      onClick={onDemo}
      disabled={demoBusy}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
    >
      <IconCompass size={15} />
      {demoBusy ? 'Setting up the demo…' : 'Or try the demo, no sign-up needed'}
    </button>
    )}
  </div>
)

const Landing = () => {
  const navigate = useNavigate()
  const { startDemo, isAuthenticated } = useAuth()
  const platform = useInstall()
  const [helpOpen, setHelpOpen] = useState(false)
  const [demoBusy, setDemoBusy] = useState(false)

  const download = async () => {
    if (platform === 'promptable') {
      await promptInstall()
      return
    }
    setHelpOpen((open) => !open)
  }

  const tryDemo = async () => {
    setDemoBusy(true)
    try {
      await startDemo()
      navigate('/', { replace: true })
    } finally {
      setDemoBusy(false)
    }
  }

  return (
    <div className="relative min-h-[100dvh] overflow-x-clip">
      <div className="auth-backdrop" aria-hidden="true">
        <span className="auth-blob auth-blob-1" />
        <span className="auth-blob auth-blob-2" />
        <span className="auth-blob auth-blob-3" />
      </div>

      {/* ── Navbar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-line/60 bg-surface/70 backdrop-blur-md">
        <nav aria-label="Main" className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <a href="#top" className="flex items-center gap-2" aria-label="Fico, back to top">
            <FicoLogo className="h-8 w-8" />
            <span className="text-xl font-extrabold tracking-tight text-ink">Fico</span>
          </a>
          <ul className="hidden items-center gap-6 text-sm font-medium text-muted md:flex">
            {NAV.map((n) => (
              <li key={n.href}>
                <a href={n.href} className="transition-colors hover:text-ink">
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isAuthenticated ? (
              <Link to="/" className="btn btn-primary px-3.5 py-1.5 text-sm">
                Open Fico
              </Link>
            ) : (
              <>
                <Link to="/login" className="hidden px-2 text-sm font-semibold text-ink hover:text-brand sm:inline">
                  Sign in
                </Link>
                <Link to="/register" className="btn btn-primary px-3.5 py-1.5 text-sm">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      <main id="top" className="relative">
        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:px-8 lg:pb-24 lg:pt-16">
          <div className="text-center sm:text-left">
            <p className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              Now in beta · invite-only
            </p>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-6xl">
              Your money,
              <br />
              <span className="text-brand">in its place.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-muted sm:mx-0">
              Fico is a simple, private money tracker for you and the people you share costs with: family,
              housemates, or a small team. Type it in, see where it goes, and keep everyone on the same page.
            </p>
            <div className="mt-8">
              <Actions onDownload={() => void download()} helpOpen={helpOpen} platform={platform} onDemo={() => void tryDemo()} demoBusy={demoBusy} signedIn={isAuthenticated} />
            </div>
            <ul className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted sm:justify-start">
              {['Free while in beta', 'Works offline', 'No bank connection needed'].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5">
                  <IconCheck size={15} className="text-success" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="h-[26rem] sm:h-[32rem] lg:h-[36rem]">
            <AuthShowcase variant="panel" />
          </div>
        </section>

        {/* ── Features ───────────────────────────────────────────── */}
        <section id="features" className="scroll-mt-20 mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand">Features</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Everything money, in one calm place</h2>
            <p className="mt-3 text-muted">The everyday things households and small teams actually need, without the clutter.</p>
          </div>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="card p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <Icon size={20} />
                </span>
                <h3 className="mt-4 text-lg font-bold text-ink">{title}</h3>
                <p className="mt-1.5 text-sm text-muted">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── How it works ───────────────────────────────────────── */}
        <section id="how" className="scroll-mt-20 mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand">How it works</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Up and running in a minute</h2>
          </div>
          <ol className="mt-10 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="card p-5 text-center sm:text-left">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-ink">
                  {i + 1}
                </span>
                <h3 className="mt-3 text-lg font-bold text-ink">{s.title}</h3>
                <p className="mt-1 text-sm text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Why Fico ───────────────────────────────────────────── */}
        <section id="why" className="scroll-mt-20 mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="card overflow-hidden p-0 sm:p-0">
            <div className="grid gap-0 lg:grid-cols-3">
              {[
                {
                  label: 'Our purpose',
                  title: 'Money talk shouldn’t be messy',
                  body: 'Who paid the bill? Is there enough left for the week? Fico gives every household and team one honest place to look.',
                },
                {
                  label: 'Our mission',
                  title: 'Simple, private, together',
                  body: 'Help people see where their money goes, without bank logins, ads or tracking, and share it with the people who matter.',
                },
                {
                  label: 'Our vision',
                  title: 'No more end-of-month surprises',
                  body: 'A world where every household and small team knows its numbers, and plans with confidence instead of guesswork.',
                },
              ].map((b) => (
                <div key={b.label} className="border-line p-6 sm:p-8 lg:border-r lg:last:border-r-0 [&:not(:last-child)]:border-b lg:[&:not(:last-child)]:border-b-0">
                  <p className="text-sm font-semibold uppercase tracking-wider text-brand">{b.label}</p>
                  <h3 className="mt-2 text-xl font-bold text-ink">{b.title}</h3>
                  <p className="mt-2 text-sm text-muted">{b.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ────────────────────────────────────────────────── */}
        <section id="faq" className="scroll-mt-20 mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand">FAQ</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Questions, answered</h2>
          </div>
          <div className="mt-8 space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="card group p-0 sm:p-0">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-semibold text-ink">
                  {f.q}
                  <IconChevronDown size={18} className="shrink-0 text-muted transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-5 pb-4 text-sm text-muted">{f.a}</div>
              </details>
            ))}
          </div>
        </section>

        {/* ── Final call to action ───────────────────────────────── */}
        <section className="mx-auto max-w-5xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
          <div className="card relative overflow-hidden px-6 py-12 text-center sm:px-12">
            <div className="auth-panel-grid opacity-60" aria-hidden="true" />
            <div className="relative">
              <FicoLogo className="mx-auto h-14 w-14" />
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Put your money in its place</h2>
              <p className="mx-auto mt-3 max-w-lg text-muted">Install Fico on your phone or computer, or start right here in your browser.</p>
              <div className="mt-8">
                <Actions center onDownload={() => void download()} helpOpen={helpOpen} platform={platform} onDemo={() => void tryDemo()} demoBusy={demoBusy} signedIn={isAuthenticated} />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="relative border-t border-line/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between lg:px-8">
          <div className="max-w-xs">
            <div className="flex items-center gap-2">
              <FicoLogo className="h-7 w-7" />
              <span className="text-lg font-extrabold tracking-tight text-ink">Fico</span>
            </div>
            <p className="mt-2 text-sm text-muted">Personal & shared finance: typed in by you, kept on your device, synced when you’re online.</p>
          </div>
          <div className="flex flex-wrap gap-x-10 gap-y-6 text-sm">
            <div>
              <p className="font-semibold text-ink">Fico</p>
              <ul className="mt-2 space-y-1.5 text-muted">
                {NAV.map((n) => (
                  <li key={n.href}>
                    <a href={n.href} className="hover:text-ink">
                      {n.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-semibold text-ink">Account</p>
              <ul className="mt-2 space-y-1.5 text-muted">
                {isAuthenticated ? (
                  <li>
                    <Link to="/" className="hover:text-ink">
                      Open Fico
                    </Link>
                  </li>
                ) : (
                  <>
                    <li>
                      <Link to="/login" className="hover:text-ink">
                        Sign in
                      </Link>
                    </li>
                    <li>
                      <Link to="/register" className="hover:text-ink">
                        Sign up
                      </Link>
                    </li>
                  </>
                )}
              </ul>
            </div>
            <div>
              <p className="font-semibold text-ink">Legal & contact</p>
              <ul className="mt-2 space-y-1.5 text-muted">
                <li>
                  <Link to="/terms" className="hover:text-ink">
                    Terms
                  </Link>
                </li>
                <li>
                  <Link to="/privacy" className="hover:text-ink">
                    Privacy
                  </Link>
                </li>
                <li>
                  <a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex items-center gap-1.5 hover:text-ink">
                    <IconMail size={14} />
                    Contact
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <p className="border-t border-line/60 px-4 py-4 text-center text-xs text-muted">
          © {new Date().getFullYear()} IBell. All rights reserved.
        </p>
      </footer>
    </div>
  )
}

export default Landing
