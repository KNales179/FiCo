# Fico — Frontend

React + TypeScript + Vite PWA for Fico, Your Daily Financial Companion.

See the [root README](../README.md) for the project overview and usage terms,
and [`Plan/`](../Plan/) for the product specification, architecture, and
roadmap.

## Structure

```
src/
├── components/     Shared UI components
├── context/        React context providers (auth)
├── db/             IndexedDB local-first data layer (see db/README.md)
├── features/       Feature modules (auth, …)
├── hooks/          Shared hooks
├── lib/            Low-level helpers (API client)
├── pages/          Route-level views
├── repositories/   Typed data access over IndexedDB
├── services/       Backend API service modules
└── types/          Shared TypeScript types
```

The [`db/`](src/db/README.md) directory documents the local database: 16 object
stores, versioned migrations, and the repository layer the rest of the app
reads and writes through.
