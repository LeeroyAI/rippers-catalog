# Run In Xcode (Simulator)

1. Open `Rippers.xcodeproj` in Xcode
2. Select the `Rippers` scheme
3. Choose an iPhone Simulator (iPhone 16 recommended)
4. Build and Run (`Cmd+R`)

---

## Current Build State

All features compile and run. The app is functional end-to-end.

### iOS App
- **Home/Search** — rider profile setup, For You personalised picks, filter controls, live search button
- **Results** — live search results or filtered static catalog; sort options; live source badge; AI chat
- **Compare** — side-by-side specs for up to 3 bikes
- **Watchlist** — save bikes, target price alerts, 7-day price history, favourites
- **Sizing** — frame size guide by rider height
- **Trip Planner** — MKLocalSearch for trails/shops, terrain gear checklist, ride readiness card, saved bikes reference
- **Budget** — cost planning tools

### Live Search Backend
- Deployed at `https://rippers-pied.vercel.app/api/search`
- Requires `BRAVE_SEARCH_API_KEY` and `ANTHROPIC_API_KEY` in Vercel project settings
- iOS app calls it via `Rippers/Services/LiveSearchService.swift`

### Data Sources (in priority order)
1. **Live search** — Vercel function called when user taps "Search Bikes Live" (Brave Search + Claude)
2. **Live catalog feed** — GitHub raw URL fetched on launch, TTL 60 min (`useLiveCatalog: true`)
3. **Bundled catalog** — `Rippers/catalog.json` compiled into the app bundle
4. **Static fallback** — `Rippers/Data/Bikes.swift` (48 bikes, always available)

---

## Notes

- `Package.swift` is for core logic unit tests only — do not add SwiftUI files to it
- After adding or removing `.swift` files, run `ruby scripts/generate_xcodeproj.rb` to update the Xcode project
- After updating `dashboard.html`, run `node scripts/import_dashboard_data.js` to sync data files
- The live catalog URL is `https://raw.githubusercontent.com/LeeroyAI/rippers-catalog/main/Rippers/catalog.json`
- Feature flags live in `Rippers/Catalog/CatalogFeatureFlags.swift` — `useLiveCatalog` is currently `true`
