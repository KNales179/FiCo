import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts.css'
import './index.css'
import App from './App'
import { initDB } from './db'
import { initServiceWorker } from './features/pwa/swUpdate'
import { initAppearance } from './features/theme'

// index.html's inline script already stamped these attributes before this
// module ever ran (so the very first paint is never wrong) — this just
// keeps this module the one canonical place that applies the same choice,
// for consistency with everywhere else it's applied (Settings).
initAppearance()

initServiceWorker()

// Open IndexedDB and run migrations before the app reads any local data,
// then drop any tutorial sample data a tour left behind (app closed mid-tour).
// Ask the browser to keep Fico's data instead of clearing it when the
// device runs low on space — that's where offline records wait to sync.
// (Granted automatically for an installed app; harmless if refused.)
void navigator.storage?.persist?.().catch(() => undefined)

void initDB().then(async () => {
  const { isDemoMode } = await import('./features/demo/demoMode')
  if (isDemoMode()) return // the demo account's sample Finance lives in it
  const m = await import('./features/demo/seed')
  await m.purgeDemoDataIfLeftOver()
})

if (import.meta.env.DEV) {
  void import('./db/devtools')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
