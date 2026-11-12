import { Link } from 'react-router-dom'
import { PageHeader, Card } from '../components/ui'
import { useState } from 'react'
import {
  IconCheck,
  IconCloudOff,
  IconHeart,
  IconMessage,
  IconInfo,
} from '../components/icons'

/** Copies the GCash number, with a brief "Copied" confirmation. */
const CopyNumber = ({ value }: { value: string }) => {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1800)
        })
      }}
      className="btn btn-sm ml-auto"
    >
      {copied && <IconCheck size={13} />}
      {copied ? 'Copied' : 'Copy number'}
    </button>
  )
}

const Credits = () => (
  <div className="mx-auto max-w-3xl space-y-4">
    <PageHeader icon={IconInfo} title="Credits" description="About Fico, and who built it." />

    <Card>
      <h2 className="section-title">What Fico is</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Fico is a local-first personal and family finance app — recording
        income, expenses, and transfers; managing cash and bank balances;
        turning a shopping list into an expense automatically; tracking
        bills and electricity usage; reconciling cash on hand; and sharing
        selected records with family. It works offline on a device that's
        already signed in, and syncs when a connection comes back. Every
        number in it is typed in by hand — Fico doesn't connect to any
        bank, e-wallet, or payment provider.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Built as a Progressive Web App: installable on a phone or desktop,
        works offline, and updates itself in the background.
      </p>
    </Card>

    <Card>
      <h2 className="section-title">Built by</h2>
      <p className="mt-2 text-sm text-ink">
        <strong>IBell</strong> <span className="text-muted">(Ivhel)</span>
      </p>
      <ul className="mt-2 space-y-1 text-sm">
        <li>
          <a
            href="https://knales179.github.io/portfolio-Nales/#/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand underline"
          >
            Portfolio
          </a>
        </li>
        <li>
          <a href="mailto:ibelldev179@gmail.com" className="text-brand underline">
            ibelldev179@gmail.com
          </a>
        </li>
      </ul>
      <p className="mt-3 text-xs text-muted">
        Found a bug, or have a suggestion?{' '}
        <Link to="/feedback" className="inline-flex items-center gap-1 text-brand underline">
          <IconMessage size={13} />
          Report & feedback
        </Link>
      </p>
    </Card>

    <Card className="border-warning/40">
      <h2 className="section-title flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/15 text-warning">
          <IconCloudOff size={16} />
        </span>
        Why going online can be slow
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Fico's server runs on a free hosting plan, which falls asleep when no
        one has used it for a while. When you open Fico after a quiet spell,
        it can take a little while to wake up before syncing and other online
        features kick in — your records still work offline in the meantime.
        Even a paid plan (about $7 a month) would only shorten that wake-up
        time, not remove it completely.
      </p>
    </Card>

    <Card className="border-brand/40">
      <h2 className="section-title flex items-center gap-2">
        <span className="card-icon">
          <IconHeart size={16} />
        </span>
        Support Fico
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        If Fico helps you and you'd like to support it, you can send a
        donation through GCash. Every bit goes toward keeping it running and
        getting better.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel-2 px-4 py-3">
        <div>
          <p className="text-xs text-muted">GCash</p>
          <p className="text-lg font-bold tabular-nums tracking-wide text-ink">0954 330 5828</p>
        </div>
        <CopyNumber value="09543305828" />
      </div>
      <p className="mt-2 text-xs text-muted">
        Please add a note (like “Fico support”) so I know what it's for. Thank you!
      </p>
    </Card>

    <p className="text-center text-xs text-muted">
      © {new Date().getFullYear()} IBell. All rights reserved.
    </p>
  </div>
)

export default Credits
