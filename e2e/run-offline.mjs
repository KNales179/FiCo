// Offline end-to-end tests — one command:  npm run test:offline
//
// Starts a throwaway in-memory MongoDB, the backend (from ../backend)
// pointed at it, a production build of this app (service worker included)
// on http://localhost:5318, then drives Chrome through the offline
// scenarios in ./offline.scenarios.mjs. Nothing touches a real database,
// and no email is sent. Needs Google Chrome installed, and the backend repo
// checked out next to this one (../backend) with its dependencies installed.
import { spawn, execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { runScenarios } from './offline.scenarios.mjs'
import { runRoleScenarios } from './roles.scenarios.mjs'

// `--roles` runs only the roles/badges suite; `--offline` only the offline one.
const only = process.argv.find((a) => a === '--roles' || a === '--offline')

const here = path.dirname(fileURLToPath(import.meta.url))
const frontend = path.resolve(here, '..')
const backend = path.resolve(frontend, '..', 'backend')
const outDir = path.join(here, '.dist')
const API_PORT = 5099
const WEB_PORT = 5318
const isWin = process.platform === 'win32'
const children = []

const start = (cmd, args, opts) => {
  const child = spawn(cmd, args, { shell: isWin, stdio: ['ignore', 'pipe', 'pipe'], ...opts })
  child.stdout.on('data', () => {})
  child.stderr.on('data', (d) => {
    const line = String(d)
    if (/error/i.test(line) && !/ExperimentalWarning/.test(line)) process.stderr.write(`[${cmd}] ${line}`)
  })
  children.push(child)
  return child
}

const stopAll = () => {
  for (const child of children) {
    try {
      if (isWin) execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' })
      else child.kill('SIGTERM')
    } catch {
      // already gone
    }
  }
}

const waitFor = async (url, label, timeoutMs = 120_000) => {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`${label} didn't start (${url})`)
}

const portInUse = async (port) => {
  try {
    await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(1500) })
    return true
  } catch {
    return false
  }
}

let mongo
let exitCode = 1
try {
  // Something already running on our ports would silently be tested instead.
  for (const port of [API_PORT, WEB_PORT]) {
    if (await portInUse(port)) throw new Error(`port ${port} is already in use — stop whatever is running there first`)
  }

  console.log('• starting a throwaway database…')
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
  const MONGODB_URI = mongo.getUri('fico_e2e')

  console.log('• building the app (production, with service worker)…')
  execSync(`npx vite build --outDir "${outDir}" --emptyOutDir`, {
    cwd: frontend,
    stdio: 'ignore',
    env: { ...process.env, VITE_API_URL: `http://localhost:${API_PORT}/api` },
  })

  console.log('• starting the backend and the app…')
  start('npx', ['tsx', 'src/server.ts'], {
    cwd: backend,
    env: {
      ...process.env,
      MONGODB_URI,
      PORT: String(API_PORT),
      FRONTEND_URL: `http://localhost:${WEB_PORT}`,
      NODE_ENV: 'development',
      SESSION_SECRET: 'e2e-only-not-a-real-secret',
      // Never send real email / push / uploads from a test run.
      BREVO_API_KEY: '',
      BREVO_SENDER_EMAIL: '',
      VAPID_PUBLIC_KEY: '',
      VAPID_PRIVATE_KEY: '',
      CLOUDINARY_URL: '',
      CLOUDINARY_CLOUD_NAME: '',
      CLOUDINARY_API_KEY: '',
      CLOUDINARY_API_SECRET: '',
    },
  })
  start('npx', ['vite', 'preview', '--outDir', `"${outDir}"`, '--port', String(WEB_PORT), '--strictPort'], { cwd: frontend })
  await waitFor(`http://localhost:${API_PORT}/api/health`, 'Backend')
  await waitFor(`http://localhost:${WEB_PORT}/`, 'App')

  const base = `http://localhost:${WEB_PORT}/`
  let failures = 0
  if (only !== '--roles') failures += await runScenarios(base)
  if (only !== '--offline') failures += await runRoleScenarios(base, MONGODB_URI)
  exitCode = failures === 0 ? 0 : 1
} catch (error) {
  console.error('\n✗ Could not run the offline tests:', error.message)
} finally {
  stopAll()
  await mongo?.stop().catch(() => undefined)
}
process.exit(exitCode)
