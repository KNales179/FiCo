# Fico — Frontend

React + TypeScript + Vite PWA for Fico, Your Daily Financial Companion.

See the [root README](../README.md) for the project overview and usage terms,
and [`Plan/`](../Plan/) for the product specification, architecture, and
roadmap.

## Structure

```
src/
├── components/     Shared UI (space switcher, sync status, attachments, money widgets)
├── context/        React providers: auth, space, money, shopping, bills
├── db/             IndexedDB local-first data layer (see db/README.md)
├── domain/         Pure rules: money, transactions, shopping, bills, items,
│                   electricity, analytics
├── features/       Local-first feature modules that write to IndexedDB and
│                   queue sync events (auth, money, shopping, items, bills,
│                   attachments, reconciliation, analytics, sync)
├── hooks/          useAuth, useSpace, useMoney, useShopping, useBills,
│                   useMutationContext, useOnlineStatus
├── lib/            API client (NetworkError vs ApiError)
├── pages/          Login, Register, Home (dashboard), Shopping, Bills, Analytics
├── repositories/   Typed data access over IndexedDB
└── types/          Shared TypeScript types
```

Every user action writes to IndexedDB first and adds an entry to the sync
queue; the queue is drained to the backend by the sync engine (Roadmap
Phase 18).
