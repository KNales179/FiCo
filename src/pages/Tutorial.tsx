import type { ComponentType, ReactNode } from 'react'
import { PageHeader, Card } from '../components/ui'
import {
  IconCamera,
  IconCart,
  IconReceipt,
  IconCalendar,
  IconChart,
  IconUsers,
  IconCloudOff,
  IconPalette,
  type IconProps,
} from '../components/icons'

const Section = ({
  icon: Icon,
  title,
  children,
}: {
  icon: ComponentType<IconProps>
  title: string
  children: ReactNode
}) => (
  <Card>
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
        <Icon size={18} />
      </span>
      <div>
        <h2 className="section-title">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">{children}</p>
      </div>
    </div>
  </Card>
)

const Tutorial = () => (
  <div className="mx-auto max-w-2xl space-y-4">
    <PageHeader
      title="How Fico works"
      description="The basics — two minutes, come back to this anytime from the menu."
    />

    <Section icon={IconCart} title="Record money as it happens">
      "Quick add" on the dashboard is the fastest way in — pick Spent,
      Received, or Transfer, type an amount, pick an account and category,
      and it's recorded. Everything you enter is typed by hand; Fico never
      connects to a bank or e-wallet to fetch anything automatically.
    </Section>

    <Section icon={IconCamera} title="Or scan a receipt instead">
      From the dashboard, "Scan a receipt" reads a photo of one right on
      your device — nothing is sent anywhere for it. It fills in what it
      can read confidently and leaves the rest blank for you to check,
      rather than guessing. Works for several receipts in one go, too.
    </Section>

    <Section icon={IconCart} title="Shopping lists become expenses">
      Plan a trip on the Shopping page — add items, check them off and
      price them as you go. Tap "Complete shopping" when you're done and
      it turns straight into one recorded expense, itemized. The Shopping
      page and your transaction history stay independent after that —
      editing or deleting the list later never changes what was already
      recorded.
    </Section>

    <Section icon={IconReceipt} title="Bills, tracked and reminded">
      Add a recurring bill once — Fico tracks its due date, and pays
      forward the next occurrence each time you record a payment. A bill
      only becomes payable in the week before it's due (or any time once
      it's overdue) — early is blocked on purpose, so an already-paid bill
      never looks unpaid by mistake.
    </Section>

    <Section icon={IconCalendar} title="A budget built from your own history">
      The Budget page projects what's coming — bills due, your usual
      weekly categories — from your own past recording, with plain,
      explainable numbers. Not a guess, not financial advice: just your
      own history, organized.
    </Section>

    <Section icon={IconChart} title="Analytics, including who's active">
      See spending by category and by person, income vs. expenses over
      time, and an "Active points" score per member — how much each of
      you actually records and uses Fico, not just whether you opened it.
    </Section>

    <Section icon={IconUsers} title="Share a Finance with family">
      Switch spaces from the top-left dropdown. A personal Finance is just
      you; create a Family one to invite others — everyone sees shared
      records, and any record can still be marked private to just you.
    </Section>

    <Section icon={IconCloudOff} title="Works without a connection">
      Once you've signed in on a device, Fico keeps working offline —
      record a purchase with no signal, and it syncs the moment you're
      back online. Nothing is ever lost waiting for a connection.
    </Section>

    <Section icon={IconPalette} title="Make it yours">
      Settings has theme (light/dark/system), 15 color palettes, text
      size, row density, and which notifications you want. All saved to
      this device — everyone in your Finance can set their own.
    </Section>
  </div>
)

export default Tutorial
