// Shared-Finance roles and Fico badges — run by ./run-offline.mjs (npm run test:e2e).
import { chromium } from 'playwright-core'
import { MongoClient } from 'mongodb'
import { readFileSync } from 'node:fs'

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
const register = async (page, base) => {
  const u = 'r' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10)
  await page.goto(base + 'register')
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
  await page.goto(base + 'login')
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
    await A.page.getByRole('switch', { name: 'Beta tester' }).click()
    await A.page.waitForTimeout(1500)
    check('an admin can give Beta tester', (await A.page.getByRole('switch', { name: 'Beta tester' }).getAttribute('aria-checked')) === 'true')

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

    await A.ctx.close()
    await B.ctx.close()
  } finally {
    await mongo.close()
    await browser.close()
  }
  console.log(failures === 0 ? '\nAll role checks passed.' : `\n${failures} role check(s) failed.`)
  return failures
}
