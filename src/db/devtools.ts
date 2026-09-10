/**
 * Dev-only console helpers. Loaded lazily from `main.tsx` when `import.meta.env.DEV`.
 *
 * In the browser console:
 *   await fico.db.initDB()
 *   await fico.repositories.accounts.getAll()
 *   await fico.deleteDatabase()   // wipe local data
 *
 * Useful for manually checking persistence across reloads and browser restarts
 * (Roadmap Phase 3).
 */
import * as db from './index'
import { repositories } from '../repositories'
import { closeDB, deleteDatabase, getDB } from './database'

declare global {
  interface Window {
    fico?: {
      db: typeof db
      repositories: typeof repositories
      getDB: typeof getDB
      closeDB: typeof closeDB
      deleteDatabase: typeof deleteDatabase
    }
  }
}

window.fico = {
  db,
  repositories,
  getDB,
  closeDB,
  deleteDatabase,
}

console.info(
  '[fico] dev tools ready — try `await fico.repositories.metadata.all()`',
)
