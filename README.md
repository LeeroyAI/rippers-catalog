# Rippers

[![Platform](https://img.shields.io/badge/platform-iOS%2017%2B-orange)](#requirements)
[![Swift](https://img.shields.io/badge/Swift-5.10-F05138?logo=swift&logoColor=white)](#requirements)
[![Xcode](https://img.shields.io/badge/Xcode-15%2B-147EFB?logo=xcode&logoColor=white)](#requirements)

Rippers is a SwiftUI iOS app for mountain bike discovery and comparison, built for Australian riders.  
It finds bikes live from the web based on your profile, budget, ride style, and destination.

## Getting Started (60 seconds)

```bash
git clone https://github.com/LeeroyAI/rippers-catalog.git
cd rippers-catalog
open Rippers.xcodeproj
```

Then in Xcode: select `Rippers` scheme → pick an iPhone simulator → press `Cmd + R`.

---

## Features

### iOS App
- **Rider profiles** — name, age, height, weight, experience, style, budget cap, avatar photo
- **For You** — personalised top 5 picks on the home screen based on active profile
- **Live search** — searches real AU retailer websites via Brave Search + Claude AI extraction
- **Filter engine** — category, wheel size, travel, brand, budget, eBike mode, profile-tailored ranking
- **Results** — sort by Best Match, Price, Brand, Biggest Savings; live source badge
- **Compare** — side-by-side specs for up to 3 bikes
- **Watchlist** — save bikes, set target prices, track 7-day price history, mark favourites
- **Sizing** — frame size recommendations based on rider height
- **Trip planner** — destination search, gear checklist by terrain type, ride readiness check
- **Saved searches** — save and reapply filter combinations with one tap

### Backend (Vercel)
- **Live search API** (`api/search.js`) — serverless function at `https://rippers-pied.vercel.app/api/search`
  - Accepts: `category`, `budget`, `wheel`, `style`, `travel`, `brands`, `ebike`, `country`
  - Queries Brave Search API for real AU retailer pages
  - Uses Claude (claude-sonnet-4-6) to extract structured `BikeRecord` JSON from snippets
  - Returns up to 30 results; CDN-cached for 1 hour
- **Daily catalog refresh** — GitHub Action runs at 2am AEST, rebuilds `catalog.json` from live web data

---

## Project Structure

```
Rippers/
├── Catalog/          — CatalogStore, feature flags, repository, providers
├── Data/             — Static data: Bikes.swift, Retailers.swift, BikeImages.swift, Quotes.swift
├── Models/           — Bike, BikeRecord, FilterState, RiderProfile, WatchlistItem
├── Results/          — ResultsView, BikeDetailView, BikeCardView
├── Search/           — SearchView, BikeFilterEngine
├── Services/         — LiveSearchService (calls Vercel API)
├── Shared/           — AppState, FilterStore, Theme, Formatting
├── TripPlanner/      — TripPlannerView with gear checklist and ride readiness
├── Watchlist/        — WatchlistView
├── Compare/          — CompareView
├── Sizing/           — SizingView
├── Budget/           — BudgetView
└── catalog.json      — Bundled catalog snapshot (also published as live feed)

api/
└── search.js         — Vercel serverless live search function

scripts/
├── import_dashboard_data.js  — Parses dashboard.html → Swift data files + catalog.json
├── publish_catalog.sh        — Pushes catalog.json to GitHub (updates live feed)
└── fetch_live_catalog.js     — Daily batch fetcher (used by GitHub Action)

.github/workflows/
└── update_catalog.yml        — Daily cron: refresh catalog.json at 2am AEST
```

---

## Live Search Setup

The live search backend is deployed on Vercel. To use it:

### Environment variables required

| Variable | Where to get it |
|----------|----------------|
| `BRAVE_SEARCH_API_KEY` | [brave.com/search/api](https://brave.com/search/api) — Search plan, includes $5 free/month |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) — API Keys section |

### Add keys to Vercel

```bash
vercel env add BRAVE_SEARCH_API_KEY production
vercel env add ANTHROPIC_API_KEY production
```

### Deploy

```bash
npm install -g vercel
vercel login
vercel deploy --prod
```

Then update `LiveSearchService.baseURL` in `Rippers/Services/LiveSearchService.swift` with the deployed URL.

### Add keys to GitHub (for daily catalog refresh)

In GitHub repo → Settings → Secrets → Actions, add the same two keys so the cron job can run.

---

## Catalog Data Flow

```
dashboard.html
    ↓ node scripts/import_dashboard_data.js
Rippers/Data/Bikes.swift          ← compiled into app (static fallback)
Rippers/catalog.json              ← bundled + published as live feed
    ↓ scripts/publish_catalog.sh
GitHub raw URL (live feed)        ← fetched by CatalogStore on launch
    ↑
.github/workflows/update_catalog.yml  ← daily refresh via Brave + Claude
```

For purely live search (not catalog-based), the iOS app calls the Vercel function directly when the user taps "Search Bikes Live".

---

## Requirements

- macOS with Xcode 15+ (Xcode 16 recommended)
- iOS 17+ simulator or device
- Swift 5.10 toolchain
- Node.js 20+ (for scripts and Vercel function)

---

## Run the App (Xcode)

1. Open `Rippers.xcodeproj` in Xcode
2. Select the `Rippers` scheme
3. Choose an iPhone simulator (iPhone 16 recommended)
4. Press `Cmd + R`

## Command-Line Build (Simulator)

```bash
xcodebuild -project Rippers.xcodeproj -scheme Rippers -showdestinations
xcodebuild -project Rippers.xcodeproj -scheme Rippers \
  -destination "platform=iOS Simulator,id=<simulator-uuid>" -quiet
```

## Run Unit Tests

```bash
swift test
swift test --filter BikeFilterEngineTests/testCategoryFilter
```

## Import Data from dashboard.html

```bash
node scripts/import_dashboard_data.js
# Then regenerate the Xcode project if new .swift files were added:
ruby scripts/generate_xcodeproj.rb
```

## Publish Live Catalog

```bash
./scripts/publish_catalog.sh
```

---

## License

Proprietary — LeeroyAI. All rights reserved.
