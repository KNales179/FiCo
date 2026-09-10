# Local data layer (IndexedDB)

Fico is local-first: every read and write goes to IndexedDB first, and the
backend syncs afterwards (Architecture §3). This directory owns the browser
database; the [`repositories/`](../repositories) layer is the API the rest of
the app uses.

## Files

| File            | Responsibility                                                        |
| --------------- | ------------------------------------------------------------------- |
| `schema.ts`     | `DB_NAME`, `DB_VERSION`, and the typed `FicoDB` store/index shape    |
| `migrations.ts` | `STORE_DEFINITIONS` (the 16 stores) + the ordered migration runner   |
| `database.ts`   | `getDB()` singleton connection, `closeDB()`, `deleteDatabase()`      |
| `bootstrap.ts`  | `initDB()` — open + migrate + ensure baseline metadata (`deviceId`)  |
| `devtools.ts`   | Dev-only `window.fico` console helpers                               |

## Stores

The 16 object stores map 1:1 to `Plan/02-Fico-System-Architecture.md` §6:

```
users  sessions  spaces  memberships  accounts  transactions
shoppingLists  shoppingItems  itemProfiles  priceHistory
bills  billPayments  electricityRecords  attachments
syncEvents  metadata
```

All keys are string ids (`crypto.randomUUID()`), except `metadata` which is
keyed by `key`. Timestamps are ISO strings. Money is integer minor units.

## Changing the schema

1. Edit `STORE_DEFINITIONS` in `migrations.ts` and the `FicoDB` interface in
   `schema.ts` together.
2. Bump `DB_VERSION` in `schema.ts`.
3. Append one entry to the `migrations` array — the function run when upgrading
   *to* that version. **Never edit or reorder an existing migration.**

`createMissingStores` only adds what is absent, so a fresh database and an
older one both converge to the current schema.

## Manual verification

In dev (`npm run dev`), open the console:

```js
await fico.repositories.metadata.all()          // deviceId + schema version
await fico.repositories.accounts.create({ /* … */ })
// reload the page, then:
await fico.repositories.accounts.getAll()        // still there
await fico.deleteDatabase()                      // wipe and start over
```

Automated persistence tests land with the test harness in Roadmap Phase 22.
