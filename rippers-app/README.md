# Rippers — Web app (PWA)

This folder is the **primary Rippers product**: a **Next.js** Progressive Web App for Australian MTB shoppers — catalogue browsing, profile-based match scores, compare, watchlist, trip map, sizing, and optional AI Q&A.

Parent repo: **[LeeroyAI/rippers-catalog](https://github.com/LeeroyAI/rippers-catalog)** (monorepo: `rippers-app/` + catalog pipeline + legacy Swift tree).

---

## Quick start

From **this directory** (`rippers-app/`):

```bash
npm install
npm run sync-catalog   # copies ../catalog.json → src/data/catalog.json
npm run dev
```

Open **http://localhost:3000** in your browser.

- Dev server uses **`--hostname localhost`** (see `scripts/dev.sh`). Prefer **`http://localhost:3000`** over `127.0.0.1` on macOS if IPv4 binding differs.

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Next.js development server |
| `npm run build` | Production build |
| `npm run start` | Start production server (after `build`) |
| `npm run lint` | Run ESLint |
| `npm run sync-catalog` | Refresh bundled catalogue from repo root `catalog.json` |

---

## Tech stack

- **Next.js 16** (App Router), **React 19**, **TypeScript**
- **Tailwind CSS v4** (`@import "tailwindcss"` in `app/globals.css`)
- **Leaflet** + **react-leaflet** for map-based trip UI
- **PWA** — `public/manifest.webmanifest`, icons, `app/pwa-register.tsx`

---

## App structure (orientation)

| Area | Role |
|------|------|
| `app/(main)/` | Shell routes: home, compare, watch, profile, sizing |
| `app/(map)/trip/` | Full-bleed map trip experience |
| `app/welcome/` | Onboarding / rider profile entry (also gated by middleware) |
| `app/components/` | Shared UI: `AppShell`, sheets, carousel cards, forms |
| `app/api/*` | Route Handlers: `ask`, `geocode`, `overpass`, `bike-img` |
| `src/data/catalog.ts` | Typed re-export of synced `catalog.json` |
| `src/domain/` | Filter pipeline, match scoring, rider types, trip helpers |
| `src/state/` | Client stores and React context (filters, profile, favourites, …) |

---

## Environment variables (deploy / local)

Set in **Vercel** (or `.env.local`) depending on which features you enable:

| Variable | Used by |
|----------|---------|
| Keys for `/api/ask` | As implemented in `app/api/ask/route.ts` (e.g. Anthropic or other provider) |
| Geocoding / third-party keys | `app/api/geocode`, Overpass-related routes, if required |

Consult each route file for exact names. The repo root **`api/search.js`** live-search function uses **`BRAVE_SEARCH_API_KEY`** and **`ANTHROPIC_API_KEY`** when deployed from the monorepo root.

---

## Deploy (Vercel)

Typical setup: Vercel project with **root directory** = `rippers-app` (or deploy the whole monorepo with appropriate “root” setting). Run `npm run build`; ensure `sync-catalog` has been run in CI so `src/data/catalog.json` exists before build, or copy `catalog.json` in the build step.

---

## Licence

Same as parent repository (proprietary unless stated otherwise).
