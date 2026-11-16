// The offline scenarios — run by ./run-offline.mjs (npm run test:offline).
// Each check prints ✓ / ✗; the run fails if any check fails.
import { chromium } from 'playwright-core'
import { readFileSync } from 'node:fs'
import { makeInviteCode } from './inviteCodes.mjs'

// The app's current version — marked as already seen, so "What's new" stays out of the way.
const APP_VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version

let failures = 0
const check = (label, ok, detail = '') => {
  if (ok) console.log(`  ✓ ${label}`)
  else {
    failures += 1
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}
const section = (title) => console.log(`\n${title}`)

const PASSWORD = 'Testing-pass-123'

/** One browser profile = one device. */
const newDevice = async (browser) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } })
  await ctx.addInitScript((version) => {
    sessionStorage.setItem('fico.introPlayed', '1')
    localStorage.setItem('fico.seenVersion', version)
    localStorage.setItem('fico.tutorialSeen', 'true')
  }, APP_VERSION)
  const page = await ctx.newPage()
  page.on('dialog', (d) => d.accept())
  page.on('pageerror', (e) => check('no page crash', false, e.message))
  return { ctx, page }
}

const idbAll = (page, store) =>
  page.evaluate(
    (store) =>
      new Promise((res, rej) => {
        const r = indexedDB.open('fico')
        r.onsuccess = () => {
          const q = r.result.transaction(store, 'readonly').objectStore(store).getAll()
          q.onsuccess = () => res(q.result)
          q.onerror = () => rej(q.error)
        }
        r.onerror = () => rej(r.error)
      }),
    store,
  )
const idbDelete = (page, store, key) =>
  page.evaluate(
    ({ store, key }) =>
      new Promise((res) => {
        const r = indexedDB.open('fico')
        r.onsuccess = () => {
          const tx = r.result.transaction(store, 'readwrite')
          tx.objectStore(store).delete(key)
          tx.oncomplete = () => res(true)
        }
      }),
    { store, key },
  )
const idbPut = (page, store, value) =>
  page.evaluate(
    ({ store, value }) =>
      new Promise((res, rej) => {
        const r = indexedDB.open('fico')
        r.onsuccess = () => {
          const tx = r.result.transaction(store, 'readwrite')
          tx.objectStore(store).put(value)
          tx.oncomplete = () => res(true)
          tx.onerror = () => rej(tx.error)
        }
      }),
    { store, value },
  )
const queue = async (page) => (await idbAll(page, 'syncEvents')).filter((e) => e.entityType !== 'attachment')
const status = (page) => page.evaluate(() => document.querySelector('header .mx-auto.max-w-6xl.px-3.pb-2')?.innerText.trim() ?? '')
const records = (page) => page.locator('section:has(.section-title:has-text("Records"))')
const recordRow = (page, text) => records(page).locator('tbody tr', { hasText: text }).first()
const rowTitles = (page) =>
  records(page)
    .locator('tbody tr')
    .allInnerTexts()
    .then((rows) => rows.map((r) => r.replace(/\s+/g, ' ').trim()))

let MONGO_URI = ''
const register = async (page, base) => {
  const u = 'e2e' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10)
  // The invite link fills the code in.
  await page.goto(base + 'register?code=' + (await makeInviteCode(MONGO_URI)))
  await page.fill('#username', u)
  await page.fill('#email', `${u}@example.com`)
  await page.fill('#password', PASSWORD)
  await page.fill('#confirmPassword', PASSWORD)
  await page.check('#terms')
  await page.click('button[type=submit]')
  await page.waitForURL(base, { timeout: 45_000 })
  await page.waitForTimeout(2500)
  return u
}
const signIn = async (page, base, u) => {
  await page.goto(base + 'login')
  await page.fill('#identifier', u)
  await page.fill('#password', PASSWORD)
  await page.click('button[type=submit]')
  await page.waitForURL(base, { timeout: 45_000 })
  await page.waitForTimeout(4000)
}
const addAccount = async (page, name, opening) => {
  await page.locator('section:has(.section-title:has-text("Accounts"))').first().getByRole('button', { name: 'Account', exact: true }).click()
  await page.fill('input[placeholder="Account name"]', name)
  await page.fill('input[placeholder="Opening balance"]', opening)
  await page.click('button:has-text("Add account")')
  await page.waitForTimeout(700)
}
const quickAdd = async (page, amount, title) => {
  await dismissPopups(page)
  await page.fill('input[aria-label="Amount"]', amount)
  await page.fill('input[placeholder="What for?"]', title)
  await page.click('form[data-tour="quick-add-fields"] button[type=submit]')
  await page.waitForTimeout(800)
}
/** Close a pop-up (e.g. "your edit was replaced") if one is showing. */
const dismissPopups = async (page) => {
  for (let i = 0; i < 3; i++) {
    const gotIt = page.getByRole('button', { name: 'Got it' })
    if (!(await gotIt.isVisible().catch(() => false))) return
    await gotIt.click()
    await page.waitForTimeout(400)
  }
}
const editRecord = async (page, title, patch) => {
  await dismissPopups(page)
  await recordRow(page, title).getByRole('button', { name: 'Edit' }).click()
  const form = records(page).locator('form').filter({ has: page.locator('input[placeholder="Amount"]') }).first()
  if (patch.amount) await form.locator('input[placeholder="Amount"]').fill(patch.amount)
  if (patch.title) await form.locator('input[placeholder="What for?"]').fill(patch.title)
  await form.locator('button[type=submit]').click()
  await page.waitForTimeout(800)
}
const switchFinance = async (page, name) => {
  await page.getByRole('button', { name: 'Switch Finance' }).click()
  await page.getByRole('listbox', { name: 'Finances' }).getByRole('option', { name: new RegExp(name) }).click()
  await page.waitForTimeout(2000)
}
const createFinance = async (page, name) => {
  await page.getByRole('button', { name: 'Switch Finance' }).click()
  await page.getByText('Add another Finance').click()
  await page.fill('input[placeholder^="Name it"]', name)
  await page.getByRole('button', { name: 'Create Finance' }).click()
  await page.waitForTimeout(3000)
}
/** Make sure the service worker controls the page (so it opens offline). */
const readyForOffline = async (page) => {
  await page.evaluate(() => Promise.race([navigator.serviceWorker?.ready, new Promise((r) => setTimeout(r, 20_000))]))
  await page.reload()
  await page.waitForTimeout(3000)
}
const waitForSync = async (page, ms = 20_000) => {
  const until = Date.now() + ms
  while (Date.now() < until) {
    if ((await queue(page)).length === 0) return true
    await page.waitForTimeout(1000)
  }
  return false
}

export const runScenarios = async (base, mongoUri) => {
  MONGO_URI = mongoUri
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    // ── 1. Records offline ────────────────────────────────────────
    section('1. Records offline: add / edit / delete show at once, sync later')
    const A = await newDevice(browser)
    const userA = await register(A.page, base)
    await addAccount(A.page, 'Wallet', '5000')
    await quickAdd(A.page, '150', 'Lunch')
    await waitForSync(A.page)
    check('online status shows when it last synced', /synced/i.test(await status(A.page)), await status(A.page))
    await readyForOffline(A.page)
    await A.ctx.setOffline(true)
    await A.page.waitForTimeout(1200)

    await quickAdd(A.page, '80', 'Coffee')
    check('offline add appears in Records', (await rowTitles(A.page)).some((r) => r.includes('Coffee')))
    await editRecord(A.page, 'Lunch', { amount: '175' })
    check('offline edit appears in Records', (await rowTitles(A.page)).some((r) => r.includes('Lunch') && r.includes('175')))
    await recordRow(A.page, 'Coffee').getByRole('button', { name: 'Delete' }).click()
    await A.page.waitForTimeout(800)
    check('offline delete disappears from Records', !(await rowTitles(A.page)).some((r) => r.includes('Coffee')))
    const offStatus = await status(A.page)
    check('offline status counts changes and says when last synced', /waiting to sync/.test(offStatus) && /last synced/.test(offStatus), offStatus)

    await A.page.reload().catch(() => undefined)
    await A.page.waitForTimeout(3000)
    check('app reopens offline with the changes', (await rowTitles(A.page)).some((r) => r.includes('Lunch') && r.includes('175')))

    // Receipt photos need a connection.
    await recordRow(A.page, 'Lunch').getByRole('button', { name: 'Details' }).click()
    await A.page.waitForTimeout(500)
    check('receipt attaching is turned off offline', (await records(A.page).getByText('Connect to the internet to attach a receipt photo').count()) > 0)

    // Log out offline warns instead of deleting.
    await A.page.locator('header button[aria-haspopup="menu"]').click()
    await A.page.getByRole('menuitem', { name: 'Log out' }).click()
    await A.page.waitForTimeout(800)
    check('log out with unsynced changes warns first', (await A.page.getByText('Some changes haven’t synced yet').count()) > 0)
    await A.page.getByRole('button', { name: 'Stay signed in' }).click()

    await A.ctx.setOffline(false)
    check('changes sync once back online', await waitForSync(A.page, 30_000))
    // A personal Finance has its own Activity: your history, no Members tab.
    await A.page.goto(base + 'activity')
    await A.page.waitForTimeout(2500)
    await dismissPopups(A.page)
    const personalActivity = (await A.page.locator('main').innerText()).replace(/\s+/g, ' ')
    check('a personal Finance shows its own Activity', /You updated record "Lunch".*Amount: .*→ ₱175/.test(personalActivity), personalActivity.slice(0, 300))
    check('…with no Members tab', (await A.page.getByRole('link', { name: 'Members & roles' }).count()) === 0)
    await A.page.goto(base)
    await A.page.waitForTimeout(1500)

    // ── 2. Several Finances ───────────────────────────────────────
    section('2. Several Finances')
    await createFinance(A.page, 'Family')
    check('a new Finance is switched to', (await A.page.getByRole('button', { name: 'Switch Finance' }).innerText()).includes('Family'))
    await addAccount(A.page, 'Family cash', '3000')
    const accounts = await idbAll(A.page, 'accounts')
    const familyCash = accounts.find((a) => a.name === 'Family cash')
    const wallet = accounts.find((a) => a.name === 'Wallet')
    check('its first account lands in the new Finance', familyCash && wallet && familyCash.spaceId !== wallet.spaceId)
    await waitForSync(A.page)
    await switchFinance(A.page, 'Personal')
    await A.ctx.setOffline(true)
    await A.page.waitForTimeout(1000)
    await quickAdd(A.page, '60', 'Snacks')
    await switchFinance(A.page, 'Family')
    await quickAdd(A.page, '500', 'Groceries')

    // Shopping trip offline.
    await A.page.click('header nav >> text=To-buy')
    await A.page.waitForTimeout(1200)
    await A.page.fill('input[placeholder="New list (e.g. Weekend grocery)"]', 'Palengke')
    await A.page.locator('form:has(input[placeholder="New list (e.g. Weekend grocery)"]) button[type=submit]').click()
    await A.page.waitForTimeout(800)
    await A.page.locator('text=Palengke').first().click()
    for (const item of ['Fish', 'Veggies']) {
      await A.page.fill('input[placeholder="Add item"]', item)
      await A.page.locator('form:has(input[placeholder="Add item"]) button[type=submit]').click()
      await A.page.waitForTimeout(400)
    }
    const boxes = A.page.locator('input[type=checkbox]')
    for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).check().catch(() => undefined)
    await A.page.waitForTimeout(600)
    const waiting = await status(A.page)
    const n = Number(waiting.match(/(\d+) changes? waiting/)?.[1] ?? 0)
    check('the waiting count is things done, not internal steps (expect 3)', n === 3, waiting)

    await A.page.click('header nav >> text=Dashboard')
    await A.ctx.setOffline(false)
    check('changes in every Finance sync', await waitForSync(A.page, 30_000))
    check('no change was refused', !/couldn’t be saved/.test(await status(A.page)), await status(A.page))

    // ── 3. A Finance never opened on a device ─────────────────────
    section('3. Every Finance is downloaded in the background')
    const B = await newDevice(browser)
    await signIn(B.page, base, userA)
    await B.page.waitForTimeout(8000)
    const bTxns = (await idbAll(B.page, 'transactions')).map((t) => t.title)
    check('a second device has the Finance it never opened', bTxns.includes('Groceries') && bTxns.includes('Snacks'), bTxns.join(', '))
    const familyId = familyCash?.spaceId
    await readyForOffline(B.page)
    if ((await B.page.getByRole('button', { name: 'Switch Finance' }).innerText()).includes('Family')) await switchFinance(B.page, 'Personal')
    await idbDelete(B.page, 'metadata', `sync.cursor.${familyId}`)
    await B.ctx.setOffline(true)
    await B.page.waitForTimeout(1000)
    await switchFinance(B.page, 'Family')
    check('offline in a never-downloaded Finance says so', /isn’t on this device yet/.test(await status(B.page)), await status(B.page))
    await B.ctx.setOffline(false)
    await B.page.waitForTimeout(6000)

    // ── 4. Two devices, one record ────────────────────────────────
    section('4. Two devices edit the same record')
    await switchFinance(A.page, 'Family')
    await switchFinance(B.page, 'Family').catch(() => undefined)
    await B.page.waitForTimeout(3000)
    await A.ctx.setOffline(true)
    await A.page.waitForTimeout(800)
    await editRecord(A.page, 'Groceries', { amount: '550' }) // A: amount, offline
    await B.page.reload()
    await B.page.waitForTimeout(4000)
    await editRecord(B.page, 'Groceries', { title: 'Weekly groceries' }) // B: title, online, later
    await waitForSync(B.page)
    await A.ctx.setOffline(false)
    await waitForSync(A.page, 30_000)
    await A.page.waitForTimeout(3000)
    await B.page.reload()
    await B.page.waitForTimeout(5000)
    const merged = (await idbAll(B.page, 'transactions')).find((t) => t.id && (t.title === 'Weekly groceries' || t.title === 'Groceries'))
    check('edits to different fields both survive', merged?.title === 'Weekly groceries' && merged?.amountMinor === 55000, JSON.stringify({ title: merged?.title, amount: merged?.amountMinor }))

    // Same field: the newer edit wins and the other device is told.
    await A.ctx.setOffline(true)
    await A.page.waitForTimeout(800)
    await editRecord(A.page, 'Weekly groceries', { amount: '600' })
    await A.page.waitForTimeout(1500)
    await editRecord(B.page, 'Weekly groceries', { amount: '650' })
    await waitForSync(B.page)
    await A.ctx.setOffline(false)
    await waitForSync(A.page, 30_000)
    await A.page.waitForTimeout(2500)
    check('the newer edit to the same field wins on both', (await rowTitles(A.page)).some((r) => r.includes('Weekly groceries') && r.includes('650')))
    const notes = await idbAll(A.page, 'syncEvents') // (queue should be empty now)
    check('queue empty after the conflict', notes.filter((e) => e.entityType !== 'attachment').length === 0)
    await A.page.goto(base + 'notifications')
    await A.page.waitForTimeout(1500)
    check('the overwritten edit is announced', (await A.page.getByText(/was replaced/).count()) > 0)

    // Activity (A owns Family): each edit says what changed, in its own tab.
    await A.page.goto(base + 'activity')
    await A.page.waitForTimeout(2500)
    await dismissPopups(A.page)
    const recordsTab = (await A.page.locator('main').innerText()).replace(/\s+/g, ' ')
    check('Activity shows what an edit changed', /Title: Groceries → Weekly groceries/.test(recordsTab), recordsTab.slice(0, 400))
    check('Activity uses everyday words', /record "Groceries"|record "Weekly groceries"/.test(recordsTab) && !/transaction "/.test(recordsTab))
    await A.page.getByRole('link', { name: 'Sync conflicts' }).click()
    await A.page.waitForTimeout(2000)
    const conflictsTab = (await A.page.locator('main').innerText()).replace(/\s+/g, ' ')
    check('the Sync conflicts tab lists the conflict', /newer change|conflicting edit/.test(conflictsTab), conflictsTab.slice(0, 300))
    await A.page.getByRole('link', { name: 'Members & roles' }).click()
    await A.page.waitForTimeout(2000)
    // (Both devices here are the same person, so nobody joined — the tab is filtered, not mixed with records.)
    check('the Members & roles tab shows only member changes', /No member changes yet/.test(await A.page.locator('main').innerText()))

    // ── 5. A refused change is announced with its details ─────────
    section('5. A change the server refuses')
    await A.page.goto(base)
    await A.page.waitForTimeout(2000)
    // Queue a change the real server will refuse (a ₱0 record), then sync.
    const meta = Object.fromEntries((await idbAll(A.page, 'metadata')).map((m) => [m.key, m.value]))
    const familyAccount = (await idbAll(A.page, 'accounts')).find((a) => a.name === 'Family cash')
    const now = new Date().toISOString()
    await idbPut(A.page, 'syncEvents', {
      id: 'e2e-refused-event',
      deviceId: meta['device.id'],
      userId: meta['auth.userId'],
      spaceId: familyAccount.spaceId,
      entityType: 'transaction',
      entityId: 'e2e-refused-record',
      operation: 'CREATE',
      payload: {
        id: 'e2e-refused-record',
        spaceId: familyAccount.spaceId,
        type: 'EXPENSE',
        amountMinor: 0,
        currency: 'PHP',
        title: 'Refused one',
        accountId: familyAccount.id,
        occurredAt: now,
        createdBy: meta['auth.userId'],
        createdAt: now,
        updatedAt: now,
      },
      clientVersion: 1,
      status: 'PENDING',
      retryCount: 0,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    })
    await A.page.locator('header button[title="Sync now"]').click().catch(() => undefined)
    await A.page.waitForTimeout(6000)
    await A.page.reload()
    await A.page.waitForTimeout(4000)
    check('status says a change couldn’t be saved', /couldn’t be saved/.test(await status(A.page)), await status(A.page))
    await A.page.goto(base + 'notifications')
    await A.page.waitForTimeout(1500)
    await A.page.getByRole('button', { name: /couldn’t be saved/ }).first().click()
    await A.page.waitForTimeout(400)
    const body = await A.page.locator('main').innerText()
    check('the notification lists the change and the reason', body.includes('Refused one') && /amount/i.test(body), body.slice(0, 300))

    // ── 6. Sign-in lost while offline ─────────────────────────────
    section('6. Sign-in lost while offline')
    await A.page.goto(base)
    await A.page.waitForTimeout(2000)
    await dismissPopups(A.page)
    await A.page.locator('header').getByRole('button', { name: 'discard', exact: true }).click()
    await A.page.waitForTimeout(1500)
    check('discarding clears the refused change', (await queue(A.page)).length === 0)
    await A.page.goto(base + 'notifications')
    await A.page.waitForTimeout(1200)
    check('…and keeps its details in Notifications', (await A.page.getByText(/^Discarded/).count()) > 0)
    await A.page.goto(base)
    await A.page.waitForTimeout(1500)
    await A.ctx.setOffline(true)
    await A.page.waitForTimeout(800)
    await quickAdd(A.page, '120', 'Taxi')
    await A.ctx.clearCookies()
    await A.ctx.setOffline(false)
    await A.page.waitForURL(/\/login/, { timeout: 30_000 }).catch(() => undefined)
    await A.page.waitForTimeout(1500)
    check('signed out, but the change is kept', (await queue(A.page)).length > 0)
    check('the sign-in screen says nothing was lost', (await A.page.getByText(/saved on this device/).count()) > 0)
    await A.page.fill('#identifier', userA)
    await A.page.fill('#password', PASSWORD)
    await A.page.click('button[type=submit]')
    await A.page.waitForURL(base, { timeout: 45_000 })
    const syncedAfter = await waitForSync(A.page, 30_000)
    check(
      'it syncs after signing back in',
      syncedAfter,
      JSON.stringify((await queue(A.page)).map((e) => `${e.entityType}/${e.operation}/${e.status}:${e.lastError ?? ''}`)),
    )

    await A.ctx.close()
    await B.ctx.close()
  } finally {
    await browser.close()
  }
  console.log(failures === 0 ? '\nAll offline checks passed.' : `\n${failures} offline check(s) failed.`)
  return failures
}
