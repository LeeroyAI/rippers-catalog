# Rippers — Web app (PWA)

**[LeeroyAI/rippers-catalog](https://github.com/LeeroyAI/rippers-catalog)** — a **Next.js** Progressive Web App for Australian MTB shoppers: catalogue browsing, profile-based match scores, compare, watchlist, **Ride** map (shops + named/MTB OSM trails via Overpass, parallel APIs + progress UI), sizing, and optional AI Q&A.

---

## Quick start

```bash
npm install
npm run sync-catalog   # copies catalog.json → src/data/catalog.json
npm run dev
```

Open **http://localhost:3000** in your browser.

Dev server uses `--hostname localhost` (see `scripts/dev.sh`). Prefer `http://localhost:3000` over `127.0.0.1` on macOS if IPv4 binding differs.

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
| `app/trip/` | Leaflet map: `TripMapExplorer` (search, radius, progress), `TripMapInner` |
| `app/api/*` | `ask`, `geocode`, `overpass` (+ `overpass/shops`, `overpass/trails`), `bike-img/[id]` |
| `src/server/overpass.ts` | Overpass QL, fetch/parse, bbox `unstable_cache` (~10 min) |
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

Consult each route file for exact names. The **`api/search.js`** live-search function uses **`BRAVE_SEARCH_API_KEY`** and **`ANTHROPIC_API_KEY`** when deployed to Vercel.

---

## Deploy (Vercel)

Vercel project with **root directory** = `/` (repo root). Run `npm run build`; ensure `sync-catalog` has been run so `src/data/catalog.json` exists before build, or copy `catalog.json` in the build step.

---

## Licence

Same as parent repository (proprietary unless stated otherwise).
