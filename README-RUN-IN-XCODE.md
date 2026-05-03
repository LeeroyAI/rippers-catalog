# Legacy: SwiftUI / Xcode prototype

> **This document describes the archived SwiftUI + Xcode tree under `Rippers/`.**  
> The **shipping Rippers product** is the **Next.js PWA** in **`rippers-app/`** — see the [root README](README.md) and [rippers-app/README.md](rippers-app/README.md).

The `Rippers.xcodeproj` target was an early native client for catalogue browse, live search, compare, watchlist, trip planner, and sizing. Feature work and READMEs now centre on the web app; this file remains for anyone who still opens the Xcode project or runs Swift-only tests.

---

## Run in Xcode (Simulator)

1. Open `Rippers.xcodeproj` in Xcode  
2. Select the `Rippers` scheme  
3. Choose an iPhone Simulator (e.g. iPhone 16)  
4. Build and Run (`Cmd+R`)

---

## Historical build notes

- **Home / Search** — profile, “For You” picks, filters, live search entry point  
- **Results** — catalog + live results, sorting, detail  
- **Compare** — up to 3 bikes side-by-side  
- **Watchlist** — saved bikes, pricing context  
- **Sizing** — height-based frame hints  
- **Trip planner** — native maps search, gear checklist (platform-specific)  
- **Live search** — `LiveSearchService` calling a Vercel deployment such as `https://rippers-pied.vercel.app/api/search` (`api/search.js` in this repo)

### Data sources (legacy iOS, historical)

1. Live search — Vercel `api/search.js`  
2. Live catalog URL — optional fetch (see `CatalogFeatureFlags` in the Swift tree)  
3. Bundled `Rippers/catalog.json`  
4. Static `Rippers/Data/Bikes.swift` fallback  

---

## Repo hygiene

- **`Package.swift`** — Swift package **tests only** for core filter logic; do not add SwiftUI there  
- After adding/removing `.swift` files under `Rippers/`: `ruby scripts/generate_xcodeproj.rb`  
- After updating `dashboard.html`: `node scripts/import_dashboard_data.js`  
- Example live catalog URL (if still referenced in Swift):  
  `https://raw.githubusercontent.com/LeeroyAI/rippers-catalog/main/Rippers/catalog.json`

---

## Command-line simulator build (optional)

```bash
xcodebuild -project Rippers.xcodeproj -scheme Rippers -showdestinations
xcodebuild -project Rippers.xcodeproj -scheme Rippers \
  -destination "platform=iOS Simulator,id=<simulator-uuid>" -quiet
```

```bash
swift test
swift test --filter BikeFilterEngineTests/testCategoryFilter
```
