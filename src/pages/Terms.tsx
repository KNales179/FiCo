import { Link } from 'react-router-dom'

const LAST_UPDATED = 'September 13, 2026'

const Terms = () => (
  <main className="mx-auto max-w-2xl px-4 py-10">
    <Link to="/" className="text-sm text-brand underline">
      ← Back to Fico
    </Link>

    <h1 className="page-title mt-4 text-2xl">Terms & Conditions</h1>
    <p className="mt-1 text-sm text-muted">Last updated {LAST_UPDATED}</p>

    <div className="mt-6 space-y-6 text-sm leading-relaxed text-ink">
      <section className="rounded-lg border border-warning/30 bg-warning/10 p-4">
        <h2 className="section-title text-warning">
          Fico is a personal record, not a bank
        </h2>
        <p className="mt-2 text-warning">
          Fico is a manual record-keeping tool. It is <strong>not</strong>{' '}
          connected to GCash, Maya, any bank, e-wallet, or any other
          financial institution — there is no live link to your real
          balances anywhere in the app. Every number you see here is
          exactly, and only, what you or someone in your shared Finance
          typed in by hand. It is entirely possible, and expected, for
          Fico's numbers to drift from your real accounts — a purchase you
          forgot to log, a bank fee Fico never saw, a transfer entered
          twice. Fico will never silently "correct" a mismatch on your
          behalf; catching and fixing one is on you (or whoever manages
          your Finance), using the app's reconciliation tools.
        </p>
      </section>

      <section>
        <h2 className="section-title">1. What Fico is</h2>
        <p className="mt-2">
          Fico is a local-first personal and family finance tracker. It
          stores your data on your own device first and, when you're
          online, synchronizes it to a server so it can be shared with
          other members of a Finance you belong to and backed up. Fico
          does not read your bank statements, does not connect to any
          payment provider, and does not automatically import
          transactions from anywhere. You are responsible for entering
          your own financial activity accurately and for keeping it up to
          date.
        </p>
      </section>

      <section>
        <h2 className="section-title">2. Your account</h2>
        <p className="mt-2">
          You're responsible for keeping your password confidential and
          for anything done from a device you've signed in on. Tell us (or
          revoke that device from your Account page) as soon as you
          suspect your account has been accessed by someone else. You must
          be old enough, under the law that applies to you, to agree to
          these terms on your own.
        </p>
      </section>

      <section>
        <h2 className="section-title">3. Shared Finances</h2>
        <p className="mt-2">
          If you create or join a shared ("Family") Finance, every member
          can see and add to the records in it, subject to what each
          record's own visibility is set to. Inviting someone shares that
          Finance's data with them; removing them (or leaving yourself)
          stops future access but does not erase what already happened
          while they were a member. Choose who you share a Finance with
          accordingly.
        </p>
      </section>

      <section>
        <h2 className="section-title">4. Accuracy and no financial advice</h2>
        <p className="mt-2">
          Fico's budgeting suggestions, trends, and analytics are computed
          from the data you've entered using plain, explainable rules —
          they are observations about your own recorded history, not
          financial, tax, or legal advice, and not a guarantee of your
          actual financial position. Decisions you make based on what Fico
          shows you are your own responsibility.
        </p>
      </section>

      <section>
        <h2 className="section-title">5. Availability</h2>
        <p className="mt-2">
          Fico is designed to keep working offline for data already on
          your device, but sharing with others, backups, email delivery,
          and push notifications all need the server to be reachable. We
          don't guarantee the service will always be available, error-free,
          or uninterrupted, and we may change or discontinue features with
          notice where reasonably possible.
        </p>
      </section>

      <section>
        <h2 className="section-title">6. Acceptable use</h2>
        <p className="mt-2">
          Don't use Fico to store or share anything unlawful, don't try to
          break its security or access another Finance you're not a member
          of, and don't abuse shared infrastructure (for example, sending
          excessive requests or spamming other members with invitations).
          We may suspend an account that does.
        </p>
      </section>

      <section>
        <h2 className="section-title">7. Limitation of liability</h2>
        <p className="mt-2">
          Fico is provided "as is." To the fullest extent the law allows,
          we're not liable for financial decisions made using it, for data
          loss, or for any mismatch between what's recorded in Fico and
          your real-world accounts. Keep your own backups of anything you
          can't afford to lose.
        </p>
      </section>

      <section>
        <h2 className="section-title">8. Changes to these terms</h2>
        <p className="mt-2">
          We may update these terms as Fico changes. Continuing to use
          Fico after an update means you accept the revised terms; if a
          change is significant, we'll try to make that clear in the app.
        </p>
      </section>

      <section>
        <h2 className="section-title">9. Contact</h2>
        <p className="mt-2">
          Questions about these terms, or about your data, can be raised
          through Fico's own "Report & feedback" page once you're signed
          in.
        </p>
      </section>
    </div>

    <p className="mt-8 text-sm text-muted">
      See also the{' '}
      <Link to="/privacy" className="font-medium text-brand underline">
        Privacy Policy
      </Link>
      .
    </p>
  </main>
)

export default Terms
