import { Link } from 'react-router-dom'

const LAST_UPDATED = 'November 13, 2026'

const Privacy = () => (
  <main className="mx-auto max-w-2xl px-4 py-10">
    <Link to="/" className="text-sm text-brand underline">
      ← Back to Fico
    </Link>

    <h1 className="page-title mt-4 text-2xl">Privacy Policy</h1>
    <p className="mt-1 text-sm text-muted">Last updated {LAST_UPDATED}</p>
    <p className="mt-4 text-sm leading-relaxed text-muted">
      Fico is built and run by an individual developer for a small,
      invited group of family and friends — it is not offered as a public
      product or run by a registered company. This policy explains, as
      plainly as possible, what Fico actually does with your data. It
      isn't a substitute for legal advice; if Fico's audience or purpose
      ever grows beyond private invited use, this should get a proper
      legal review for wherever it's actually used.
    </p>

    <div className="mt-6 space-y-6 text-sm leading-relaxed text-ink">
      <section>
        <h2 className="section-title">1. What Fico collects</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Account details</strong>: username, email address, and a
            securely hashed password (argon2 — the plaintext password is
            never stored). Optionally a display name, a profile picture,
            and a two-factor authentication secret if you turn that on.
          </li>
          <li>
            <strong>About you (optional)</strong>: your birthday (the year
            is optional too) and the days you usually get paid. Only you
            see these — they're never shown to other members — and Fico
            uses them only to greet you on your birthday and to word your
            own budget hints. Clear them any time in Account → About you.
          </li>
          <li>
            <strong>If you sign in with Google</strong>: Google tells Fico
            your name, your email address (and that Google has verified
            it), and your Google account id, which links your Google login
            to your Fico account. Fico doesn't get your Google password,
            contacts, files, or anything else from your Google account.
          </li>
          <li>
            <strong>Financial records you type in</strong>: transactions,
            accounts, bills, to-buy lists, categories, budgets — every
            number in Fico is something you or a member of your shared
            Finance entered by hand. Fico does not connect to, read from,
            or share data with any bank, e-wallet, or payment provider.
          </li>
          <li>
            <strong>Device information</strong>: a random device id (not
            derived from any hardware identifier) so a device you've
            logged into can be recognized and, if needed, revoked from
            your Account page; and, if you enable push notifications, a
            push subscription address handed to your browser's own push
            service.
          </li>
          <li>
            <strong>Notifications</strong>: messages Fico shows you (a
            suggestion you sent marked done, a note from the admin team) are
            kept for up to 180 days. If an admin ever signs you out,
            restricts or deletes your account, the reason they gave is
            stored with it so Fico can show it to you, and the action is
            recorded in an admin audit log.
          </li>
          <li>
            <strong>Roles and badges</strong>: your role in each shared
            Finance (Owner, Admin, Member, or Viewer) and any Fico badges
            you hold. Other members of a Finance see your role and badges
            there. Fico admins can see your badges and which shared
            Finances you belong to, with your role in each, but not the
            records inside them. Giving or removing a badge is recorded in
            the admin audit log.
          </li>
          <li>
            <strong>Basic technical logs</strong>: request metadata (route,
            status code, timing) kept only for diagnosing problems — see
            §5.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="section-title">2. What Fico does not do</h2>
        <p className="mt-2">
          No advertising, no ad networks, no analytics or tracking
          scripts, no selling or renting of your data to anyone, and no
          third-party embeds that load code from outside Fico's own
          server other than the fonts/services listed in §4. Fico's
          "smart" features (budget suggestions, category detection) run
          entirely on data already in your own space — nothing is sent to
          an external AI provider.
        </p>
      </section>

      <section id="cookies">
        <h2 className="section-title">3. Cookies</h2>
        <p className="mt-2">
          Fico sets exactly one cookie: a session cookie that keeps you
          signed in. It's strictly necessary for the app to function —
          there's no way to use an account-based feature without it — and
          it carries no tracking or advertising purpose. Because it's
          strictly necessary and nothing else is set, Fico doesn't show a
          cookie-consent banner; most privacy frameworks (including the
          Philippines' Data Privacy Act guidance and the EU's ePrivacy
          rules) exempt cookies that are essential to the service you
          asked for. Fico also keeps a small amount of data in your
          browser's local storage — your appearance preferences (theme,
          colour, font, text size), your personal display currency and the
          last exchange rates looked up, which sections you've folded away,
          and whether you've seen the welcome tour and the latest update
          notes — and, more substantially, in your browser's
          IndexedDB, which is where your financial records actually live
          on your device for offline use. None of this is shared with any
          other website.
        </p>
      </section>

      <section>
        <h2 className="section-title">4. Who else sees data, and why</h2>
        <p className="mt-2">A few outside services help run Fico:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>MongoDB</strong> — hosts the database, which is where
            everything in §1 is stored server-side.
          </li>
          <li>
            <strong>Cloudinary</strong> — stores uploaded images (receipt
            photos and profile pictures). Receipts are kept private and
            only reachable through a signed link issued after checking you
            belong to that Finance; a profile picture is stored as a
            plain, unsigned image, since it's meant to be freely visible to
            people you share a Finance with.
          </li>
          <li>
            <strong>Brevo</strong> — sends the two transactional emails
            Fico ever sends: verifying your email address, and a password
            reset link. It's given only the email address and the message
            content needed for that.
          </li>
          <li>
            <strong>Google</strong> — only if you choose "Continue with
            Google": Google confirms who you are and shares the details
            listed in §1. Signing in this way is covered by Google's own
            privacy policy as well; you can always use a username and
            password instead.
          </li>
          <li>
            <strong>Your browser's own push service</strong> (e.g. one run
            by Google, Mozilla, or Apple, depending on your browser) — if
            you turn on push notifications, it's the one actually
            delivering them; Fico's server only hands it an encrypted
            payload it can't read the contents of without your device's
            key.
          </li>
          <li>
            <strong>open.er-api.com</strong> (an exchange-rate service) —
            only when you convert between currencies (a cross-currency
            transfer, or your personal display currency). Fico asks it for
            the rate between two currency codes and nothing else: no
            amounts, records, or account details are sent. Like any website
            you contact, it can see the request coming from your device.
          </li>
        </ul>
        <p className="mt-2">
          None of these are asked to do anything with your data beyond the
          specific job above. Fico doesn't control their own security
          practices, but all of them are established providers with their
          own public security and privacy documentation.
        </p>
      </section>

      <section>
        <h2 className="section-title">5. Logs and troubleshooting</h2>
        <p className="mt-2">
          Fico keeps a lightweight technical log (which route was hit,
          how long it took, whether it succeeded) so problems can be
          diagnosed — not a record of what you personally did in the app.
          Logs are kept only as long as the hosting platform retains
          console output, are not sold or shared, and are not
          cross-referenced with any advertising identifier (there isn't
          one).
        </p>
      </section>

      <section>
        <h2 className="section-title">6. How long data is kept</h2>
        <p className="mt-2">
          Your account and financial records are kept for as long as your
          account exists. You can delete your own account at any time from
          the Account page, which removes your login credentials; if
          you're the only member of a personal Finance, its records go
          with it. A shared Finance's records persist for its other
          members if you leave it, since it's genuinely shared data — the
          same way a group chat doesn't erase for everyone when one person
          leaves it.
        </p>
      </section>

      <section>
        <h2 className="section-title">7. Security</h2>
        <p className="mt-2">
          Passwords are hashed with argon2, never stored or logged in
          plain text. Sessions are httpOnly cookies checked against a
          server-side session record, with optional two-factor
          authentication (an authenticator-app code) available to every
          account. Rate limiting is
          applied to login, password reset, and other sensitive actions to
          slow down abuse. No system is perfectly secure, and Fico can't
          guarantee against every possible attack — but reasonable,
          standard precautions are in place.
        </p>
      </section>

      <section>
        <h2 className="section-title">8. Children</h2>
        <p className="mt-2">
          Fico isn't directed at children and isn't knowingly used to
          collect data from anyone below the age at which they can
          legally agree to these terms on their own where they live.
        </p>
      </section>

      <section>
        <h2 className="section-title">9. Your rights</h2>
        <p className="mt-2">
          You can see everything Fico has recorded about you inside the
          app itself, correct any of it yourself, export nothing
          automatically today (that's on the roadmap), and delete your
          account at any time. If you're in the Philippines, the Data
          Privacy Act of 2012 (Republic Act No. 10173) gives you the right
          to access, correct, and request erasure of your personal data —
          reach out through Fico's "Report & feedback" page for any
          request this policy doesn't already let you do yourself in the
          app.
        </p>
      </section>

      <section>
        <h2 className="section-title">10. Changes to this policy</h2>
        <p className="mt-2">
          If this policy changes in a way that matters, we'll try to make
          that visible in the app rather than silently updating this page.
        </p>
      </section>
    </div>

    <p className="mt-8 text-sm text-muted">
      See also the{' '}
      <Link to="/terms" className="font-medium text-brand underline">
        Terms & Conditions
      </Link>
      .
    </p>
  </main>
)

export default Privacy
