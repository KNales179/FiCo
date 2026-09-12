import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initDB } from './db'
import { initServiceWorker } from './features/pwa/swUpdate'

initServiceWorker()

// Open IndexedDB and run migrations before the app reads any local data.
void initDB()

if (import.meta.env.DEV) {
  void import('./db/devtools')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
