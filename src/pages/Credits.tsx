import { Link } from 'react-router-dom'
import { PageHeader, Card } from '../components/ui'
import { IconMessage } from '../components/icons'

const Credits = () => (
  <div className="mx-auto max-w-2xl space-y-4">
    <PageHeader title="Credits" description="About Fico, and who built it." />

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

    <p className="text-center text-xs text-muted">
      © {new Date().getFullYear()} IBell. All rights reserved.
    </p>
  </div>
)

export default Credits
