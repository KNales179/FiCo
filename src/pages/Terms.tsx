import { Link } from 'react-router-dom'

const LAST_UPDATED = 'November 16, 2026'

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
          Fico is a local-first personal and shared finance tracker. It
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
        <p className="mt-2">
          While Fico is in beta, creating an account needs a one-time invite
          code from a Fico admin. A code works once and only for one hour
          after it's made, can't be sold or traded, and an unused one can be
          cancelled at any time. Accounts
          created with a code get the Beta tester badge. Signing in to an
          account you already have never needs a code.
        </p>
        <p className="mt-2">
          Two-step sign-in (2FA) is optional and available to every
          account. If you turn it on, keep your backup codes somewhere
          safe — they're the way back in if you lose your phone. If you
          lose both, a Fico admin can turn two-step sign-in off for your
          account after you confirm it's you; that signs your account out
          everywhere, and you sign in again with just your password.
        </p>
      </section>

      <section>
        <h2 className="section-title">3. Shared Finances</h2>
        <p className="mt-2">
          If you create or join a shared Finance, every member
          can see and add to the records in it, subject to what each
          record's own visibility is set to. That includes to-buy lists
          and bills: in a shared Finance, other members can see, add to,
          tick off, pay, and complete them, unless something is marked
          Private. The Finance's currency is shared too and can be changed
          only by its owner. Inviting someone shares that Finance's data
          with them; removing them (or leaving yourself)
          stops future access but does not erase what already happened
          while they were a member. Choose who you share a Finance with
          accordingly.
        </p>
        <p className="mt-2">
          Each member of a shared Finance has a role. The <strong>Owner</strong>{' '}
          invites and removes people, sets everyone else's role, and can hand
          ownership to someone else. <strong>Admins</strong> can add and change
          everything, can invite people and remove members and viewers (but
          not change anyone's role), and can see the Finance's Activity — who
          added, changed, or deleted what, and when. <strong>Members</strong> can add and change
          records. <strong>Viewers</strong> can see everything a member could but
          can't change anything. Giving someone Admin means they can see each
          member's Activity in that Finance, so choose admins you trust. Roles
          are enforced by Fico's server, not just hidden in the app.
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
        <p className="mt-2">
          The same goes for usage tracking on bills (electricity in kWh,
          water in m³, LPG in kg, fuel in litres): cost per unit and usage
          trends are worked out only from the amounts and readings you type
          in. They aren't read from your meter or provider and won't match
          your provider's official rates or computations exactly.
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
          notice where reasonably possible. Fico's server currently runs on
          a free hosting plan that sleeps when idle, so the first online
          action after a quiet period can take a while; this is expected
          and isn't a fault in your data.
        </p>
      </section>

      <section>
        <h2 className="section-title">6. Guided tours, the demo, and sample data</h2>
        <p className="mt-2">
          The guided tours under "How Fico works" show a temporary Sample
          Finance filled with made-up records. It exists only on your
          device while a tour runs, is never sent to the server or shared
          with anyone, and is deleted when the tour ends. It isn't real
          and doesn't reflect your own finances.
        </p>
        <p className="mt-2">
          "Try the demo" on the sign-in screen works the same way: a
          pretend account with made-up records and pretend members, kept
          only on your device. Nothing you do in the demo reaches the
          server, and leaving the demo erases all of it — it can't be
          turned into a real account's data.
        </p>
      </section>

      <section>
        <h2 className="section-title">7. Currency conversions</h2>
        <p className="mt-2">
          Converted amounts — your personal display currency, and the
          amount that lands in a different-currency account on a transfer —
          use a daily exchange rate from an outside rate service (or the
          last rate Fico saw, when offline). They're approximate, for
          convenience only, and may differ from the rate a bank or
          remittance service would actually give you. Your personal
          display currency is a view on your device only: it never changes
          a record or what anyone else in your Finance sees.
        </p>
      </section>

      <section>
        <h2 className="section-title">8. Donations</h2>
        <p className="mt-2">
          Fico is free to use. Supporting it through the GCash details on
          the Credits page is entirely voluntary — a donation doesn't buy
          any extra features, priority, or guarantee of service, and isn't
          handled or refundable through the app itself. Please include a
          note so it can be identified.
        </p>
      </section>

      <section>
        <h2 className="section-title">9. Acceptable use</h2>
        <p className="mt-2">
          Don't use Fico to store or share anything unlawful, don't try to
          break its security or access another Finance you're not a member
          of, and don't abuse shared infrastructure (for example, sending
          excessive requests or spamming other members with invitations).
          We may suspend an account that does.
        </p>
      </section>

      <section>
        <h2 className="section-title">10. Badges</h2>
        <p className="mt-2">
          Fico may show badges on a profile, such as Fico Owner, Fico Admin,
          or Beta tester. Badges are given at Fico's discretion as a thank
          you or to show someone's role in running Fico. They have no cash
          value, can't be bought, sold, or transferred, and may be changed
          or removed at any time. A badge on its own doesn't give its holder
          any access to your Finances.
        </p>
      </section>

      <section>
        <h2 className="section-title">11. Limitation of liability</h2>
        <p className="mt-2">
          Fico is provided "as is." To the fullest extent the law allows,
          we're not liable for financial decisions made using it, for data
          loss, or for any mismatch between what's recorded in Fico and
          your real-world accounts. Keep your own backups of anything you
          can't afford to lose.
        </p>
      </section>

      <section>
        <h2 className="section-title">12. Changes to these terms</h2>
        <p className="mt-2">
          We may update these terms as Fico changes. Continuing to use
          Fico after an update means you accept the revised terms; if a
          change is significant, we'll try to make that clear in the app
          (for example in the "What's new" notes, also listed under
          Menu → Updates).
        </p>
      </section>

      <section>
        <h2 className="section-title">13. Contact</h2>
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
