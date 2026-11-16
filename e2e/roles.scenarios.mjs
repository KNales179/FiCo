// Shared-Finance roles and Fico badges — run by ./run-offline.mjs (npm run test:e2e).
import { chromium } from 'playwright-core'
import { MongoClient } from 'mongodb'
import { readFileSync } from 'node:fs'
import { makeInviteCode } from './inviteCodes.mjs'

const APP_VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
const PASSWORD = 'Testing-pass-123'
let failures = 0
const check = (label, ok, detail = '') => {
  if (ok) console.log(`  ✓ ${label}`)
  else {
    failures += 1
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

const device = async (browser) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } })
  await ctx.addInitScript((v) => {
    sessionStorage.setItem('fico.introPlayed', '1')
    localStorage.setItem('fico.seenVersion', v)
    localStorage.setItem('fico.tutorialSeen', 'true')
  }, APP_VERSION)
  const page = await ctx.newPage()
  page.on('dialog', (d) => d.accept())
  page.on('pageerror', (e) => check('no page crash', false, e.message))
  return { ctx, page }
}
const closePopups = async (page) => {
  for (let i = 0; i < 3; i++) {
    const b = page.getByRole('button', { name: 'Got it' })
    if (!(await b.isVisible().catch(() => false))) return
    await b.click()
    await page.waitForTimeout(300)
  }
}
let MONGO_URI = ''
const register = async (page, base, code) => {
  const u = 'r' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10)
  await page.goto(base + 'register?code=' + (code ?? (await makeInviteCode(MONGO_URI))))
  await page.fill('#username', u)
  await page.fill('#email', `${u}@example.com`)
  await page.fill('#password', PASSWORD)
  await page.fill('#confirmPassword', PASSWORD)
  await page.check('#terms')
  await page.click('button[type=submit]')
  try {
    await page.waitForURL(base, { timeout: 45_000 })
  } catch (error) {
    const said = await page.locator('form').innerText().catch(() => '')
    throw new Error(`sign-up didn’t finish: ${said.replace(/\s+/g, ' ').slice(-200)}`)
  }
  await page.waitForTimeout(2500)
  return u
}
const signIn = async (page, base, u) => {
  // Signed in already? /login would send us home — sign out first.
  await page.evaluate(() => fetch('http://localhost:5099/api/auth/logout', { method: 'POST', credentials: 'include' })).catch(() => undefined)
  await page.goto(base)
  await page.waitForTimeout(2500)
  await page.goto(base + 'login')
  await page.waitForSelector('#identifier', { timeout: 30_000 })
  await page.fill('#identifier', u)
  await page.fill('#password', PASSWORD)
  await page.click('button[type=submit]')
  await page.waitForURL(base, { timeout: 45_000 })
  await page.waitForTimeout(3000)
}
const switchTo = async (page, name) => {
  await closePopups(page)
  await page.getByRole('button', { name: 'Switch Finance' }).click()
  await page.getByRole('listbox', { name: 'Finances' }).getByRole('option', { name: new RegExp(name) }).click()
  await page.waitForTimeout(2500)
}

export const runRoleScenarios = async (base, mongoUri) => {
  MONGO_URI = mongoUri
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const mongo = await MongoClient.connect(mongoUri)
  try {
    console.log('\n7. Shared-Finance roles')
    const A = await device(browser)
    const owner = await register(A.page, base)
    const B = await device(browser)
    const other = await register(B.page, base)

    // A makes a shared Finance with an account, and invites B.
    await A.page.getByRole('button', { name: 'Switch Finance' }).click()
    await A.page.getByText('Add another Finance').click()
    await A.page.fill('input[placeholder^="Name it"]', 'My Store')
    await A.page.getByRole('button', { name: 'Create Finance' }).click()
    await A.page.waitForTimeout(2500)
    await A.page.locator('section:has(.section-title:has-text("Accounts"))').first().getByRole('button', { name: 'Account', exact: true }).click()
    await A.page.fill('input[placeholder="Account name"]', 'Till')
    await A.page.fill('input[placeholder="Opening balance"]', '1000')
    await A.page.click('button:has-text("Add account")')
    await A.page.waitForTimeout(4000)
    await A.page.goto(base + 'members')
    await A.page.waitForTimeout(1500)
    await A.page.fill('input[placeholder="their email"]', `${other}@example.com`)
    await A.page.getByRole('button', { name: 'Invite' }).click()
    await A.page.waitForTimeout(2000)

    // A makes B a viewer.
    const roleSelect = A.page.getByLabel(new RegExp(`Role for ${other}`))
    check('the owner gets a role picker for each member', (await roleSelect.count()) === 1)
    await roleSelect.selectOption('VIEWER')
    await A.page.waitForTimeout(1500)

    // B, as a viewer.
    await B.page.reload()
    await B.page.waitForTimeout(3000)
    await switchTo(B.page, 'My Store')
    await B.page.waitForTimeout(3000)
    await closePopups(B.page)
    const bText = await B.page.locator('main').innerText()
    check('a viewer is told they can only look', /you’re a viewer/i.test(bText))
    check('a viewer gets no Quick add', (await B.page.locator('input[aria-label="Amount"]').count()) === 0)
    await B.page.locator('header button[aria-haspopup="menu"]').click()
    check('a viewer has no Activity in the menu', (await B.page.getByRole('menuitem', { name: 'Activity' }).count()) === 0)
    await B.page.keyboard.press('Escape')
    await B.page.goto(base + 'notifications')
    await B.page.waitForTimeout(1500)
    check('a viewer is told about the role change', (await B.page.getByText(/now a viewer in My Store/).count()) > 0)

    // The server refuses a viewer's change even if the app were bypassed.
    const spaceId = (await mongo.db().collection('spaces').findOne({ name: 'My Store' }))?._id
    const refused = await B.page.evaluate(async ({ spaceId }) => {
      const res = await fetch(`http://localhost:5099/api/spaces/${spaceId}/sync/push`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: [] }),
      })
      return { status: res.status, body: await res.json() }
    }, { spaceId: String(spaceId) })
    check('the server refuses a viewer’s changes', refused.status === 403 && refused.body.code === 'VIEWER_READ_ONLY', JSON.stringify(refused))

    // Now an admin.
    await A.page.getByLabel(new RegExp(`Role for ${other}`)).selectOption('ADMIN')
    await A.page.waitForTimeout(1500)
    await B.page.goto(base)
    await B.page.waitForTimeout(3000)
    await closePopups(B.page)
    await B.page.locator('header button[aria-haspopup="menu"]').click()
    check('an admin sees Activity in the menu', (await B.page.getByRole('menuitem', { name: 'Activity' }).count()) === 1)
    await B.page.keyboard.press('Escape')
    await B.page.goto(base + 'activity')
    await B.page.waitForTimeout(2000)
    check('an admin can open Activity', /made .* an admin|added/i.test(await B.page.locator('main').innerText()))
    check('an admin gets Quick add', await (async () => {
      await B.page.goto(base)
      await B.page.waitForTimeout(2500)
      await closePopups(B.page)
      return (await B.page.locator('input[aria-label="Amount"]').count()) === 1
    })())

    // A Finance admin manages people but not roles.
    await B.page.goto(base + 'members')
    await B.page.waitForTimeout(2000)
    await closePopups(B.page)
    check('a Finance admin can invite people', (await B.page.getByRole('button', { name: 'Invite' }).count()) === 1)
    check('a Finance admin gets no role picker', (await B.page.getByLabel(/Role for/).count()) === 0)
    const adminApi = await B.page.evaluate(async ({ spaceId, ownerId }) => {
      const call = (method, path, body) =>
        fetch(`http://localhost:5099/api/spaces/${spaceId}${path}`, {
          method,
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
        }).then((r) => r.status)
      return {
        role: await call('PATCH', `/members/${ownerId}/role`, { role: 'VIEWER' }),
        removeOwner: await call('DELETE', `/members/${ownerId}`),
        invite: await call('POST', '/invitations', { email: 'someone-new@example.com' }),
      }
    }, { spaceId: String(spaceId), ownerId: String((await mongo.db().collection('users').findOne({ username: owner }))._id) })
    check('a Finance admin can’t change roles', adminApi.role === 403, JSON.stringify(adminApi))
    check('a Finance admin can’t remove the owner', adminApi.removeOwner === 403, JSON.stringify(adminApi))
    check('a Finance admin can send an invitation', adminApi.invite >= 200 && adminApi.invite < 300, JSON.stringify(adminApi))

    // Another member's device re-sending a default category that already
    // exists (it seeded before downloading the Finance) is a quiet duplicate:
    // nothing overwritten, nothing in Activity.
    const db = mongo.db()
    const aCategory = await db.collection('syncrecords').findOne({ spaceId, entityType: 'category', deletedAt: null })
    const conflictsBefore = await db.collection('actionlogs').countDocuments({ spaceId, action: { $in: ['CONFLICT', 'CREATE'] }, entityType: 'category' })
    const reseed = await B.page.evaluate(async ({ spaceId, record }) => {
      const res = await fetch(`http://localhost:5099/api/spaces/${spaceId}/sync/push`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: [{ id: 'e2e-reseed-' + Date.now(), entityType: 'category', entityId: record.id, operation: 'CREATE', payload: { ...record, name: 'Reset name' }, clientVersion: 1 }],
        }),
      })
      return (await res.json()).results?.[0]?.status
    }, { spaceId: String(spaceId), record: aCategory?.payload })
    const conflictsAfter = await db.collection('actionlogs').countDocuments({ spaceId, action: { $in: ['CONFLICT', 'CREATE'] }, entityType: 'category' })
    const kept = await db.collection('syncrecords').findOne({ _id: aCategory?._id })
    check('re-sending an existing default category is a quiet duplicate', reseed === 'duplicate' && conflictsAfter === conflictsBefore, JSON.stringify({ reseed, conflictsBefore, conflictsAfter }))
    check('…and never overwrites it', kept?.payload?.name === aCategory?.payload?.name)

    // Profile tags.
    await A.page.goto(base + 'account')
    await A.page.waitForTimeout(2000)
    check('the owner’s profile shows an “Owner · n” tag', (await A.page.getByRole('button', { name: /Owner\s*·\s*1/ }).count()) === 1)
    await B.page.goto(base + 'account')
    await B.page.waitForTimeout(2000)
    const adminTag = B.page.getByRole('button', { name: /Admin\s*·\s*1/ })
    check('the admin’s profile shows an “Admin · n” tag', (await adminTag.count()) === 1)
    await adminTag.click()
    check('the tag opens the list of those Finances', (await B.page.getByText('My Store').count()) > 0)

    // Signed in: sign-in and sign-up send you home; the front page says "Open Fico".
    await B.page.goto(base + 'login')
    await B.page.waitForTimeout(2000)
    check('signed in, /login goes to the dashboard', new URL(B.page.url()).pathname === '/')
    await B.page.goto(base + 'register')
    await B.page.waitForTimeout(2000)
    check('signed in, /register goes to the dashboard', new URL(B.page.url()).pathname === '/')
    await closePopups(B.page)
    await B.page.locator('header button[aria-haspopup="menu"]').click()
    await B.page.getByRole('menuitem', { name: 'About Fico' }).click()
    await B.page.waitForTimeout(2000)
    check('About Fico opens the front page without signing out', new URL(B.page.url()).pathname === '/welcome' && (await B.page.getByRole('link', { name: 'Open Fico' }).count()) > 0)
    // Signed in: the front page's tour button stays in your own account (no demo swap).
    await B.page.getByRole('button', { name: 'Take a guided tour' }).click()
    await B.page.waitForURL(/\/tutorial/, { timeout: 15_000 }).catch(() => undefined)
    check('signed in, the tour button opens How Fico works in your own account', B.page.url().includes('/tutorial') && (await B.page.getByText('Demo mode').count()) === 0)

    console.log('\n8. Fico badges')
    // Make A a Fico admin (the way the first admin is made: in the database).
    await mongo.db().collection('users').updateOne({ username: owner }, { $set: { role: 'ADMIN' } })
    await signIn(A.page, base, owner)
    await A.page.goto(base + 'admin')
    await A.page.waitForTimeout(2000)
    await A.page.locator('a[href^="/admin/users/"]', { hasText: owner }).click()
    await A.page.waitForTimeout(2000)
    await A.page.getByRole('switch', { name: 'Fico Owner' }).click()
    await A.page.waitForTimeout(1500)
    check('the first Fico Owner badge can be given', (await A.page.getByRole('switch', { name: 'Fico Owner' }).getAttribute('aria-checked')) === 'true')
    await A.page.goto(base + 'admin')
    await A.page.waitForTimeout(1500)
    await closePopups(A.page)
    await A.page.locator('a[href^="/admin/users/"]', { hasText: other }).click()
    await A.page.waitForTimeout(2000)
    await closePopups(A.page)
    // They joined with an invite code, so they're a Beta tester already.
    const beta = A.page.getByRole('switch', { name: 'Beta tester' })
    check('joining with a code already gave Beta tester', (await beta.getAttribute('aria-checked')) === 'true')
    await beta.click()
    await A.page.waitForTimeout(1500)
    check('an admin can take Beta tester off', (await beta.getAttribute('aria-checked')) === 'false')
    await beta.click()
    await A.page.waitForTimeout(1500)
    check('an admin can give Beta tester', (await beta.getAttribute('aria-checked')) === 'true')

    await B.page.goto(base + 'account')
    await B.page.waitForTimeout(2500)
    check('the badge shows on their profile', (await B.page.getByText('Beta tester').count()) > 0)
    await A.page.goto(base + 'account')
    await A.page.waitForTimeout(2500)
    const aText = await A.page.locator('main').innerText()
    check('the owner shows Fico Owner and Fico Admin', aText.includes('Fico Owner') && aText.includes('Fico Admin'))

    // Only a Fico Owner may give Fico Owner.
    await mongo.db().collection('users').updateOne({ username: other }, { $set: { role: 'ADMIN' } })
    await signIn(B.page, base, other)
    const denied = await B.page.evaluate(async (u) => {
      const list = await (await fetch('http://localhost:5099/api/admin/users', { credentials: 'include' })).json()
      const target = list.users.find((x) => x.username === u)
      const res = await fetch(`http://localhost:5099/api/admin/users/${target.id}/badges`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ badge: 'FICO_OWNER', on: true }),
      })
      return res.status
    }, other)
    check('another admin can’t give themselves Fico Owner', denied === 403, String(denied))

    // Nobody — the Fico Owner included — can make someone else Fico Owner,
    // and no admin can take the Fico Owner's admin access away.
    const ownerGives = await A.page.evaluate(async (u) => {
      const list = await (await fetch('http://localhost:5099/api/admin/users', { credentials: 'include' })).json()
      const target = list.users.find((x) => x.username === u)
      const res = await fetch(`http://localhost:5099/api/admin/users/${target.id}/badges`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ badge: 'FICO_OWNER', on: true }),
      })
      return res.status
    }, other)
    check('the Fico Owner can’t make someone else Fico Owner', ownerGives === 403, String(ownerGives))
    const demote = await B.page.evaluate(async ({ u, pw }) => {
      const list = await (await fetch('http://localhost:5099/api/admin/users', { credentials: 'include' })).json()
      const target = list.users.find((x) => x.username === u)
      const res = await fetch(`http://localhost:5099/api/admin/users/${target.id}/role`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'USER', confirmPassword: pw, reason: 'test' }),
      })
      return res.status
    }, { u: owner, pw: PASSWORD })
    check('an admin can’t remove the Fico Owner’s admin access', demote === 403, String(demote))

    console.log('\n9. Invite-only sign-up')
    // No code: the form won't send, and the server refuses anyway.
    const C = await device(browser)
    // A first-time visitor gets the front page; its Sign up goes to sign-up.
    await C.page.goto(base)
    await C.page.waitForTimeout(2000)
    check('a first-time visitor sees the front page', (await C.page.getByRole('heading', { name: /Know where/ }).count()) === 1)
    check('the front page offers Download and Sign up', (await C.page.getByRole('button', { name: 'Download the app' }).count()) > 0 && (await C.page.getByRole('link', { name: 'Sign up' }).count()) > 0)
    // "Take the guided demo" goes straight to How Fico works, in demo mode.
    const D = await device(browser)
    await D.page.goto(base)
    await D.page.waitForTimeout(2000)
    await D.page.getByRole('button', { name: 'Take the guided demo' }).click()
    await D.page.waitForURL(/\/tutorial/, { timeout: 30_000 }).catch(() => undefined)
    check('the guided demo opens How Fico works', D.page.url().includes('/tutorial') && (await D.page.getByText('Demo mode').count()) > 0)
    await D.ctx.close()
    await C.page.getByRole('link', { name: 'Sign up' }).first().click()
    await C.page.waitForURL(/\/register/, { timeout: 10_000 }).catch(() => undefined)
    check('Sign up on the front page opens sign-up', C.page.url().includes('/register'))
    // A wrong password: the field shakes and turns red.
    await C.page.goto(base + 'login')
    await C.page.fill('#identifier', 'nobody-' + Date.now())
    await C.page.fill('#password', 'not-the-password')
    await C.page.click('button[type=submit]')
    await C.page.waitForTimeout(2500)
    check('a wrong password turns the field red', await C.page.locator('#password.field-wrong').count() === 1)
    await C.page.fill('#password', 'x')
    check('…until it is edited', await C.page.locator('#password.field-wrong').count() === 0)
    await C.page.goto(base + 'register')
    await C.page.waitForTimeout(1000)
    check('the sign-up page says it’s invite-only', (await C.page.getByText('Sign-up is invite-only for now').count()) === 1)
    check('it says how to get a beta tester code', (await C.page.locator('a[href^="mailto:ibelldev179@gmail.com"]').count()) === 1)
    await C.page.fill('#username', 'nocode' + Date.now().toString().slice(-6))
    await C.page.fill('#email', `nocode${Date.now()}@example.com`)
    await C.page.fill('#password', PASSWORD)
    await C.page.fill('#confirmPassword', PASSWORD)
    await C.page.check('#terms')
    await C.page.click('button[type=submit]')
    await C.page.waitForTimeout(800)
    check('no code: asked for one, no account', C.page.url().includes('/register') && (await C.page.getByText('Enter your invite code').count()) > 0)
    const api = await C.page.evaluate(async (pw) => {
      const post = (body) =>
        fetch('http://localhost:5099/api/auth/register', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'sneaky' + Date.now().toString().slice(-6), email: `sneaky${Date.now()}@example.com`, password: pw, termsAccepted: true, ...body }),
        }).then(async (r) => ({ status: r.status, code: (await r.json()).code }))
      return { none: await post({}), bogus: await post({ inviteCode: 'FICO-AAAA-BBBB' }) }
    }, PASSWORD)
    check('the server refuses a sign-up with no code', api.none.status === 400, JSON.stringify(api))
    check('the server refuses a made-up code', api.bogus.status === 403 && api.bogus.code === 'INVITE_REQUIRED', JSON.stringify(api))

    // A code over an hour old no longer works.
    const stale = await makeInviteCode(MONGO_URI, 'e2e expired', true)
    await C.page.goto(base + 'register?code=' + stale)
    await C.page.fill('#username', 'late' + Date.now().toString().slice(-6))
    await C.page.fill('#email', `late${Date.now()}@example.com`)
    await C.page.fill('#password', PASSWORD)
    await C.page.fill('#confirmPassword', PASSWORD)
    await C.page.check('#terms')
    await C.page.click('button[type=submit]')
    await C.page.waitForTimeout(3000)
    check('an expired code is refused, and says so', C.page.url().includes('/register') && (await C.page.getByText(/has expired/).count()) > 0)

    // A Fico admin makes a code on Admin → Invite codes …
    await A.page.goto(base + 'admin')
    await A.page.waitForTimeout(1500)
    await closePopups(A.page)
    await A.page.getByRole('link', { name: 'Invite codes' }).click()
    await A.page.waitForTimeout(1500)
    await A.page.fill('input[placeholder^="e.g. Ate Liza"]', 'e2e friend')
    await A.page.getByRole('button', { name: 'Make code' }).click()
    await A.page.waitForTimeout(1500)
    const made = (await A.page.locator('code').first().innerText()).trim()
    check('an admin can make an invite code', /^FICO-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(made), made)

    // … someone signs up with it (typed, lower-case and without dashes) …
    const friend = await register(C.page, base, made.toLowerCase().replace(/-/g, ''))
    await C.page.goto(base + 'account')
    await C.page.waitForTimeout(2000)
    await closePopups(C.page)
    check('signing up with a code gives the Beta tester badge', (await C.page.getByText('Beta tester').count()) > 0)

    // … and the code is spent.
    const reuse = await C.page.evaluate(async ({ code, pw }) => {
      const r = await fetch('http://localhost:5099/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'again' + Date.now().toString().slice(-6), email: `again${Date.now()}@example.com`, password: pw, termsAccepted: true, inviteCode: code }),
      })
      return r.status
    }, { code: made, pw: PASSWORD })
    check('a used code can’t be used again', reuse === 403, String(reuse))
    await A.page.reload()
    await A.page.waitForTimeout(1500)
    await A.page.getByRole('tab', { name: /^Used/ }).click()
    check('the admin sees who used the code', (await A.page.getByRole('link', { name: '@' + friend }).count()) === 1)

    console.log('\n10. Deleting an account')
    // Owning a shared Finance others still use: hand it over first.
    const blocked = await A.page.evaluate(async (pw) => {
      const r = await fetch('http://localhost:5099/api/auth/me', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      })
      return { status: r.status, code: (await r.json()).code }
    }, PASSWORD)
    check('owning a shared Finance others use blocks deleting', blocked.status === 409 && blocked.code === 'OWNS_SHARED_FINANCES', JSON.stringify(blocked))

    // The friend deletes their account from the Account page.
    const users = mongo.db().collection('users')
    const before = await users.findOne({ username: friend })
    const personal = await mongo.db().collection('spaces').findOne({ ownerId: before._id, type: 'PERSONAL' })
    await C.page.goto(base + 'account')
    await C.page.waitForTimeout(2500)
    await closePopups(C.page)
    await C.page.getByRole('button', { name: 'Delete my account…' }).click()
    await C.page.fill('#delete-password', PASSWORD)
    await C.page.getByLabel('Type DELETE to confirm').fill('delete')
    await C.page.getByRole('button', { name: 'Delete my account forever' }).click()
    await C.page.waitForTimeout(4000)
    const after = await users.findOne({ _id: before._id })
    check('the account is disabled and signed out', after.status === 'DISABLED' && (await C.page.locator('#identifier').count()) > 0)
    check('their name, email and personal details are erased', after.username !== friend && !after.email.includes(friend) && (after.paydays ?? []).length === 0)
    check('their personal Finance’s records are erased', (await mongo.db().collection('syncrecords').countDocuments({ spaceId: personal._id })) === 0)
    check('their email can sign up again', (await users.countDocuments({ email: before.email })) === 0)
    check('other people’s shared Finance is untouched', Boolean(await mongo.db().collection('spaces').findOne({ name: 'My Store', deletedAt: null })))

    await C.ctx.close()
    await A.ctx.close()
    await B.ctx.close()
  } finally {
    await mongo.close()
    await browser.close()
  }
  console.log(failures === 0 ? '\nAll role checks passed.' : `\n${failures} role check(s) failed.`)
  return failures
}
