# Rippers — Web app (PWA)

[![Web](https://img.shields.io/badge/app-Next.js%20PWA-black?logo=next.js&logoColor=white)](#rippers-web-app-rippers-app)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](#rippers-web-app-rippers-app)
[![Catalog](https://img.shields.io/badge/catalog-AUD%20retailers-orange)](#catalog-data-flow)

**Rippers** is a **Progressive Web App** for Australian mountain bikers: browse a synced retailer catalogue, tune matches to your rider profile, compare bikes, save favourites, plan rides on a map (OpenStreetMap + Overpass, with named / MTB-tagged trails and bike shops), sizing hints, and optional AI Q&A — all in the browser (installable as a PWA).

This repository (**[LeeroyAI/rippers-catalog](https://github.com/LeeroyAI/rippers-catalog)**) is a **monorepo**: the shipping app, catalogue pipeline, optional Vercel live-search function, and legacy Swift prototype all live here.

The **canonical product** is **`rippers-app/`** (Next.js App Router + React + TypeScript).  
An older **SwiftUI / Xcode** tree under `Rippers/` is **legacy only** — not the maintained surface. See [README-RUN-IN-XCODE.md](README-RUN-IN-XCODE.md) if you need to open it.

---

## Rippers web app (`rippers-app/`)

### Quick start

```bash
git clone https://github.com/LeeroyAI/rippers-catalog.git
cd rippers-catalog
cd rippers-app
npm install
npm run sync-catalog   # copies ../catalog.json into src/data/catalog.json
npm run dev
```

Open **http://localhost:3000** (use `http://localhost:3000` — the dev server binds to `localhost`).

### Stack

- **Next.js** (App Router), **React**, **TypeScript**, **Tailwind CSS**
- **Leaflet** for trip / map flows
- **PWA**: web app manifest, service worker registration, installable on supported devices

### Features (web)

- **Onboarding & rider profile** — height, weight, style, e-bike preference; drives match scoring; cookie + `/welcome` flow
- **Home** — hero, synced catalogue, search + category/budget filters, ranked results, detail / match sheets, shareable `?openBike=` links
- **Compare** — side-by-side specs (up to 3 bikes)
- **Watch** — favourites / watch-style list in the browser
- **Ride (trip)** — search a place, pick radius, map with **bike shops** and **named / MTB-graded OSM trails**; parallel `/api/overpass/shops` + `/api/overpass/trails` with UI progress; server-side bbox cache (~10 min); links out to Trailforks / maps
- **Sizing** — frame / fit guidance aligned with profile data
- **Ask AI** — optional bike Q&A via `app/api/ask` (configure keys where you deploy)

### Useful commands (`rippers-app/`)

| Command | Purpose |
|--------|---------|
| `npm run dev` | Next dev server (port **3000**, `localhost`) |
| `npm run build` | Production build |
| `npm run start` | Run production server locally |
| `npm run lint` | ESLint |
| `npm run sync-catalog` | Refresh `src/data/catalog.json` from repo root `catalog.json` |

---

## Project structure (high level)

```
rippers-app/           ← Primary Rippers UI (Next.js PWA)
├── app/               — routes, layouts, UI components, Route Handlers (api/*)
├── src/data/          — catalog snapshot (catalog.json), bike images helpers
├── src/domain/        — filter engine, match score, rider profile types
└── src/state/         — client stores (filters, favourites, profile context, …)

api/
└── search.js          — Vercel serverless live search (Brave + Claude) — optional / legacy integration

scripts/
├── import_dashboard_data.js  — Parses dashboard.html → catalog + legacy Swift data
├── publish_catalog.sh        — Publishes catalog.json (e.g. to live feed)
└── fetch_live_catalog.js     — Batch fetcher (e.g. GitHub Action)

Rippers/               — Legacy SwiftUI / Xcode prototype (not the main product)
Rippers.xcodeproj
Package.swift          — Swift unit tests for filter core only

.github/workflows/
└── update_catalog.yml — Scheduled catalog refresh (when enabled)
```

---

## Backend (Vercel)

### Live search API (`api/search.js`)

Serverless function (example deployment: `https://rippers-pied.vercel.app/api/search`):

- Accepts criteria such as `category`, `budget`, `wheel`, `style`, `travel`, `brands`, `ebike`, `country`
- Queries **Brave Search** for AU retailer pages, **Claude** for structured bike extraction
- Returns up to ~30 results; CDN-friendly caching

**Environment variables**

| Variable | Purpose |
|----------|---------|
| `BRAVE_SEARCH_API_KEY` | Brave Search API |
| `ANTHROPIC_API_KEY` | Claude API |

Deploy from repo root (where `api/search.js` and `vercel.json` live, if configured):

```bash
npm i -g vercel
vercel login
vercel deploy --prod
```

The **web app** can evolve to call this endpoint directly; the legacy iOS client used `LiveSearchService.swift` against the same style of deployment.

### Next.js Route Handlers (`rippers-app/app/api/`)

- **`/api/ask`** — AI Q&A for a bike (requires provider keys in deployment env)
- **`/api/geocode`**, **`/api/overpass`** — map / trip helpers
- **`/api/bike-img/[id]`** — product imagery proxy/cache patterns as implemented

---

## Catalog data flow

```
dashboard.html
    ↓ node scripts/import_dashboard_data.js
catalog.json (repo root)     ← consumed by Next app after sync
Rippers/Data/*.swift          ← legacy Swift bundle (if you still build the prototype)

    ↓ npm run sync-catalog (from rippers-app/)
rippers-app/src/data/catalog.json

    ↓ scripts/publish_catalog.sh
GitHub raw / CDN URL         ← optional live feed for clients

    ↑ .github/workflows/update_catalog.yml  ← scheduled refresh when enabled
```

---

## Environment variables (deploy / local)

Set in **Vercel** (or `.env.local`) depending on which features you enable:

| Variable | Used by |
|----------|---------|
| Keys for `/api/ask` | As implemented in `rippers-app/app/api/ask/route.ts` (e.g. Anthropic or other provider) |
| Geocoding / third-party keys | `app/api/geocode`, Overpass-related routes, if required |

Consult each route file for exact names. The repo root **`api/search.js`** live-search function uses **`BRAVE_SEARCH_API_KEY`** and **`ANTHROPIC_API_KEY`** when deployed from the monorepo root.

---

## Deploy (Vercel)

Typical setup: Vercel project with **root directory** = `rippers-app` (or deploy the whole monorepo with an appropriate root setting). Run `npm run build`; ensure `sync-catalog` has been run in CI so `src/data/catalog.json` exists before build, or copy `catalog.json` in the build step.

- **Node.js 20+** for `rippers-app`, scripts, and Vercel functions
- **npm** (or pnpm/yarn) for the web app
- Optional: **macOS + Xcode** only if you work on the **legacy** `Rippers/` Swift prototype ([README-RUN-IN-XCODE.md](README-RUN-IN-XCODE.md))

---

## Legacy: Swift / Xcode (optional)

If you maintain or compare against the old iOS tree:

```bash
xcodebuild -project Rippers.xcodeproj -scheme Rippers -showdestinations
swift test   # Package.swift — filter engine tests only
```

See **[README-RUN-IN-XCODE.md](README-RUN-IN-XCODE.md)** for simulator steps and feature parity notes (historical).

---

## Publish live catalog

```bash
./scripts/publish_catalog.sh
```

For the ongoing maintenance checklist, see **[docs/MAINTAINING.md](docs/MAINTAINING.md)**.

---

## Licence

Same as parent repository (proprietary unless stated otherwise).
