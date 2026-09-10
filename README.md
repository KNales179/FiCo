# Fico — Frontend

React + TypeScript + Vite PWA for Fico, Your Daily Financial Companion.

See the [root README](../README.md) for the full project overview, and
[`Plan/`](../Plan/) for the product specification, architecture, and roadmap.

## Development

```bash
npm install
cp .env.example .env   # optional; VITE_API_URL defaults to http://localhost:5000/api
npm run dev            # http://localhost:5173
```

## Scripts

| Command           | Description                          |
| ----------------- | ---------------------------------- |
| `npm run dev`     | Start the Vite dev server            |
| `npm run build`   | Type-check and build for production  |
| `npm run preview` | Preview the production build         |
| `npm run lint`    | Run ESLint                           |

## Structure

```
src/
├── components/   Shared UI components (e.g. ProtectedRoute)
├── context/      React context providers (AuthContext)
├── lib/          Low-level helpers (API fetch wrapper)
├── pages/        Route-level views (Login, Register, Home)
├── services/     API service modules (authService)
└── types/        Shared TypeScript types
```
