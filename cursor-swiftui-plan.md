# Rippers — SwiftUI iOS Conversion Plan

Convert the `dashboard.html` single-page web app into a native SwiftUI iOS app.  
This document is the complete specification. Follow it top-to-bottom.

---

## 0. Source Reference

All data, logic, and feature requirements are derived from `dashboard.html` in this directory.  
Open it in a browser while building — it is the ground truth for behaviour and visual design.

---

## 1. Project Setup

1. Create a new **Xcode project** → App → SwiftUI / Swift → product name `Rippers`
2. Minimum deployment target: **iOS 17**
3. Frameworks needed (no third-party packages required except one):
   - `SwiftUI` — UI
   - `SwiftData` — persistence (replaces localStorage)
   - `MapKit` — replaces Leaflet.js in Trip Planner
   - `Combine` or `async/await` — API calls (OSM, Nominatim)
4. Add **one** Swift Package: none required unless you want charts — use SwiftUI `Chart` from `Charts` framework (ships with Xcode 15+).
5. Set accent color to `#E5470A` (Rippers orange) in `Assets.xcassets`.
6. Add app icon: orange rounded rect with white bicycle outline (matches favicon in HTML).

---

## 2. Brand Colors & Design Tokens

Create `Theme.swift`:

```swift
extension Color {
    static let rOrange      = Color(hex: "#E5470A")
    static let rOrangeDark  = Color(hex: "#C63C07")
    static let rOrangeLight = Color(hex: "#FDF1EC")
    static let rBackground  = Color(hex: "#F0ECE4")
    static let rCard        = Color.white
    static let rBorder      = Color(hex: "#E8E3DB")
    static let rTextMuted   = Color(hex: "#888888")
    static let rTextLabel   = Color(hex: "#666666")
    static let rGreen       = Color(hex: "#2EA84C")
    static let rGreenBg     = Color(hex: "#EAFAF0")
    static let rRed         = Color(hex: "#DC3545")
    static let rRedBg       = Color(hex: "#FDECEA")
    static let rYellow      = Color(hex: "#F59E0B")
    static let rYellowBg    = Color(hex: "#FFF8E1")
    static let rBlue        = Color(hex: "#2563EB")
    static let rBlueBg      = Color(hex: "#EFF6FF")
}
```

Add a `Color(hex:)` initialiser extension.

---

## 3. Data Models

### 3.1 Bike

```swift
struct Bike: Identifiable, Hashable {
    let id: Int
    let brand: String
    let model: String
    let year: Int
    let category: String         // "Trail", "Enduro", "XC / Cross-Country", "eBike"
    let wheel: String            // "24\"", "27.5\"", "29\"", "Mullet (29/27.5)"
    let travel: String           // "130mm", "Hardtail", etc.
    let suspension: String       // "Full Suspension" or "Hardtail"
    let frame: String
    let drivetrain: String
    let fork: String
    let shock: String
    let weight: String
    let brakes: String
    let description: String
    let sizes: [String]
    let prices: [String: Double]  // retailerId → price
    let wasPrice: Double?
    let inStock: [String]         // retailer IDs with stock
    let sourceUrl: String
    let isEbike: Bool
    let motorBrand: String?
    let motor: String?
    let battery: String?
    let range: String?
    let ageRange: String?         // kids bikes only

    var bestPrice: Double? { prices.values.min() }
    var bestRetailerId: String? { prices.min(by: { $0.value < $1.value })?.key }
    var savings: Double? {
        guard let was = wasPrice, let best = bestPrice else { return nil }
        return was - best
    }
}
```

### 3.2 Retailer

```swift
struct Retailer: Identifiable {
    let id: String
    let name: String
    let color: String    // hex
    let domain: String
    let isAustralian: Bool
    let searchURL: (String) -> URL  // takes bike query, returns retailer search URL
}
```

### 3.3 WatchlistItem (SwiftData)

```swift
@Model
class WatchlistItem {
    var bikeId: Int
    var addedAt: Date
    var targetPrice: Double
    var priceHistory: [Double]   // 7-day, oldest first

    init(bikeId: Int, targetPrice: Double) {
        self.bikeId = bikeId
        self.addedAt = Date()
        self.targetPrice = targetPrice
        self.priceHistory = []
    }
}
```

### 3.4 RiderProfile (SwiftData)

```swift
@Model
class RiderProfile {
    var id: UUID
    var name: String
    var age: Int
    var heightCm: Int
    var experience: String   // "beginner", "intermediate", "expert"
    var style: String        // "xc", "trail", "enduro", "dh", "ebike"
    var avatarData: Data?
    var isActive: Bool

    init(name: String, age: Int, heightCm: Int, experience: String, style: String) {
        self.id = UUID()
        self.name = name
        self.age = age
        self.heightCm = heightCm
        self.experience = experience
        self.style = style
        self.isActive = false
    }

    // Derived sizing (computed, not stored)
    var recommendedSizes: [String] { SizingHelper.sizes(forHeight: heightCm) }
    var primarySize: String? { recommendedSizes.first }
}
```

### 3.5 GearItem

```swift
struct GearItem: Identifiable {
    let id: String
    let label: String
    let emoji: String
    let prices: [BudgetTier: Double]
    let defaultOn: Bool
    let examples: [BudgetTier: [GearExample]]
}

struct GearExample {
    let name: String
    let price: Double
    let note: String
}

enum BudgetTier: String, CaseIterable {
    case budget = "Budget"
    case mid = "Mid"
    case premium = "Premium"
}
```

---

## 4. Static Data Files

Transcribe ALL data from `dashboard.html` into Swift files:

- `Data/Bikes.swift` — `let BIKES: [Bike] = [...]` (48+ bikes, all fields)
- `Data/Retailers.swift` — `let RETAILERS: [Retailer] = [...]` (20 retailers)
- `Data/GearItems.swift` — `let GEAR_ITEMS: [GearItem] = [...]` (11 categories × 3 tiers × 3 examples)
- `Data/Quotes.swift` — `let MTB_QUOTES: [String] = [...]`

Copy the exact prices, specs, and URLs from the HTML source.

---

## 5. App Architecture — MVVM

```
RippersApp.swift          ← @main, inject ModelContainer
├── ContentView.swift      ← TabView with 7 tabs
│
├── Search/
│   ├── SearchView.swift
│   └── SearchViewModel.swift
│
├── Results/
│   ├── ResultsView.swift
│   ├── BikeCardView.swift
│   ├── BikeDetailSheet.swift
│   └── ResultsViewModel.swift
│
├── Compare/
│   ├── CompareView.swift
│   └── CompareViewModel.swift
│
├── Watchlist/
│   ├── WatchlistView.swift
│   └── WatchlistViewModel.swift
│
├── Sizing/
│   └── SizingView.swift
│
├── Budget/
│   ├── BudgetView.swift
│   └── BudgetViewModel.swift
│
├── TripPlanner/
│   ├── TripPlannerView.swift
│   ├── TripPlannerViewModel.swift
│   └── ShopCardView.swift
│
├── Shared/
│   ├── Theme.swift
│   ├── SizingHelper.swift
│   ├── FilterState.swift       ← ObservableObject holding all active filters
│   └── AppState.swift          ← ObservableObject holding compareSet, activeProfile
│
└── Data/
    ├── Bikes.swift
    ├── Retailers.swift
    ├── GearItems.swift
    └── Quotes.swift
```

Use `@StateObject` / `@EnvironmentObject` for `FilterState` and `AppState`. Inject both at the root.

---

## 6. Navigation Structure

Use `TabView` with `.tabItem` for the 7 main tabs. Match the HTML nav exactly:

```swift
TabView(selection: $appState.activeTab) {
    SearchView()
        .tabItem { Label("Search", systemImage: "magnifyingglass") }
        .tag(Tab.search)
    ResultsView()
        .tabItem { Label("Results", systemImage: "list.bullet") }
        .tag(Tab.results)
    CompareView()
        .tabItem { Label("Compare", systemImage: "arrow.left.arrow.right") }
        .tag(Tab.compare)
    WatchlistView()
        .tabItem { Label("Watchlist", systemImage: "bell") }
        .tag(Tab.watchlist)
    SizingView()
        .tabItem { Label("Sizing", systemImage: "ruler") }
        .tag(Tab.sizing)
    BudgetView()
        .tabItem { Label("Budget", systemImage: "dollarsign.circle") }
        .tag(Tab.budget)
    TripPlannerView()
        .tabItem { Label("Trip", systemImage: "map") }
        .tag(Tab.trip)
}
.accentColor(.rOrange)
```

Badge the Watchlist tab with the active watch alert count.

---

## 7. Screen-by-Screen Implementation

---

### 7.1 Search Tab

**Stats Row (4 cards, horizontal scroll on small screens):**
- Bikes Found → taps to Results tab
- Best Price (lowest price across all BIKES)
- Retailers (count of unique retailers)
- Price Alerts (WatchlistItem count) → taps to Watchlist tab

Implement as `ScrollView(.horizontal)` of `StatCardView`.

**Random Quote:** `Text(MTB_QUOTES.randomElement()!)` shown below stats.

**Rider Profile Panel:**
- `Form` or custom `VStack` with:
  - `TextField` for Age (numeric keyboard)
  - Height input with unit toggle (cm / ft+in) using `Picker` segment
  - `Picker` for Experience (Any, Beginner, Intermediate, Expert)
  - `Picker` for Style (Any, XC, Trail, Enduro, Downhill, eBike)
- "Save Profile" button → saves to SwiftData active `RiderProfile`
- "Clear Profile" button → deactivates profile

**Search & Filter Panel:**
- `TextField` for text search
- `Picker` for Category
- `Picker` for Wheel Size
- `TextField` for Max Budget (numeric)
- Brand chips: horizontal `ScrollView` of `FilterChipView` — tap toggles inclusion in `FilterState.activeBrands`
- Travel chips: same pattern for `FilterState.activeTravelRanges`
- Wheel chips: same for `FilterState.activeWheels`

All filter changes publish immediately through `FilterState` — no "Search" button needed. Add a "Search" button that navigates to Results tab as a convenience shortcut.

**Recent Price Drops Section:**
- Filter `BIKES` for any with `.wasPrice` set → show top 5 sorted by biggest savings
- `ScrollView(.horizontal)` of compact `BikeCardMiniView`

---

### 7.2 Results Tab

**Toolbar (NavigationStack toolbar or custom top bar):**
- Results count: `"\(filteredBikes.count) bikes"`
- Sort `Picker` (inline or menu):
  - Price: Low to High
  - Price: High to Low
  - Brand A–Z
  - Biggest Savings
  - Best Fit for Rider (only enabled when profile active)
- Grid/List toggle: `ToolbarItem` with `Menu` or segmented control

**Rider Banner (conditional, shown when profile active):**
- Orange background strip: "Showing results for [Name] · [Height]cm · Size [M/L]"

**Age Warning Banner (conditional):**
- If active rider is a child but adult bikes are shown, show yellow warning banner
- "Include adult bikes" button toggles `FilterState.overrideAgeFilter`

**Active Filter Chips:**
- `ScrollView(.horizontal)` of dismissible chips for each active filter
- Tap `×` on chip → removes that filter from `FilterState`

**Bike Grid / List:**
- Grid: `LazyVGrid(columns: [GridItem(.adaptive(minimum: 300))])` 
- List: `LazyVStack` with full-width cards
- Iterate `filteredBikes` (derived from `FilterState` applied to `BIKES`)

**Compare Float Bar (overlay, conditional):**
- When `compareSet.count > 0` show a floating bottom bar
- Shows selected bike names + "Compare" button + "✕" clear
- Tapping "Compare" switches to Compare tab

---

### 7.3 Bike Card (`BikeCardView`)

Match the HTML card structure exactly:

```
┌─────────────────────────────┐
│ [Heart btn]    [Image]  [✓] │  ← overlay buttons
│   Brand · Model · Year      │
│   [spec pills]              │
│ ─────────────────────────── │
│ Retailer ●  $X,XXX  [BEST]  │  ← price rows
│ Retailer ●  $X,XXX          │
│ ─────────────────────────── │
│ Best Price  $X,XXX  [Deal→] │
│ [Watch] [Quiz] [+Compare]   │
└─────────────────────────────┘
```

- Heart button: toggles `WatchlistItem` favorite flag in SwiftData
- Compare checkbox: adds/removes from `AppState.compareSet` (max 3)
- Price rows: `ForEach` over `bike.prices.sorted(by value)` — highlight lowest with green + "BEST" badge
- OOS: grey text for retailer IDs not in `bike.inStock`
- Fit strip (if profile active): green/orange/red bar below card based on size availability
- "Deal" button: opens retailer search URL via `openURL`
- "Watch" button: adds `WatchlistItem` to SwiftData
- "Quiz" button: presents `BikeQuizSheet`
- "+Compare" button: toggles in `compareSet`
- Tapping card body: presents `BikeDetailSheet`

---

### 7.4 Bike Detail Sheet

Full-screen `.sheet` or `.navigationDestination`:
- Large bike image (with branded placeholder fallback using `brand` color from `RETAILERS`)
- Full specs list (`Form`-style rows or custom `VStack`)
- All retailer prices with direct "View Deal" links (`Link` or `openURL`)
- "Add to Watchlist" button
- "Add to Compare" button

---

### 7.5 Compare Tab

**Empty state:** icon + "Select up to 3 bikes in Results to compare"

**Comparison table (when bikes selected):**
- Use `ScrollView([.horizontal, .vertical])`
- Fixed left column (spec labels), scrollable right columns (one per bike)
- Up to 3 bike columns
- Header rows: bike image + brand/model + "✕" remove button
- Spec rows: best price (green for lowest), wasPrice/savings, category, wheel, travel, frame, drivetrain, fork, shock, weight, sizes (orange star for rider-matching), retailer prices
- Implement `CompareTableView` as a custom `Grid` or `LazyHStack` — not a standard `Table` (too limited for this layout)

---

### 7.6 Watchlist Tab

Two sections:

**Favourites:**
- `@Query` SwiftData for `WatchlistItem` where `isFavourite == true`
- Grid of compact `BikeCardView` (same component, just smaller)

**Watch Alerts:**
- `@Query` SwiftData for all `WatchlistItem`
- Per item:
  - Brand + model
  - Current best price (large green)
  - Previous price struck through (if `priceHistory.count > 1`)
  - Price change badge: green ↓ (drop) / red ↑ (rise) / grey (no change)
  - 7-day price chart: use `Charts` framework, `BarMark` over `priceHistory`
  - Target price status: "Target: $X · Best: $Y · $Z above" or "🎯 Target reached!"
  - "View Results →" button → filters Results to that bike
  - "Remove" button → deletes from SwiftData

---

### 7.7 Sizing Tab

**Hero header:** ruler icon + "Sizing Assistant" title

**Calculator card:**
- `TextField` for height (cm)
- Optional `TextField` for age
- `Picker` for riding style (Trail, Enduro, Downhill, XC, Park)
- "Calculate" button
- Result card (shown after calculation):
  - Recommended frame sizes with primary highlighted in orange
  - Reach, standover height, head tube angle
  - Explanatory note

Implement `SizingHelper.swift` with the sizing logic from the HTML:
- Height ranges → frame sizes (XS: 148–155cm, S: 155–168cm, M: 168–180cm, L: 178–190cm, XL: 190–200cm, XXL: 200cm+)
- Style adjustments (e.g., DH riders size up)

**Frame Size Reference Chart:**
- Static `List` or `Table` of XS–XXL with height ranges + reach + best-for column

**Wheel Size Cards (4 cards):**
- 24" (purple), 27.5" (blue), 29" (green), Mullet (orange)
- HStack or 2×2 `LazyVGrid`

**Brand Sizing Quirks table:**
- Static `List` of brands with "Runs Large / Runs Small / Runs True / Varies"

---

### 7.8 Budget Tab

**Bike selector:** `Picker` (wheel or menu) over all `BIKES` sorted A–Z  
**Bike info strip:** shows selected bike's category, wheel, travel, best price  

**Gear recommendation banner (conditional):**
- Trail/XC: "Standard helmet recommended"
- Enduro/eBike: "Convertible or full-face helmet recommended"
- DH: "Full-face essential"

**Budget tier selector:** `Picker` segmented `.budget / .mid / .premium`

**Gear list:**
- `List` of `GearItemRowView` for each of 11 categories
- Each row: checkbox toggle, emoji, label, price for selected tier, "Essential" badge
- Tap to expand → shows 3 example products (name, price, note)

**Budget breakdown panel (shown when any item selected):**
- `VStack` at bottom or `List` footer:
  - All selected items + prices
  - Bike line item
  - Gear total
  - Grand Total in large orange text
  - "View Deal →" button → opens best retailer URL for selected bike

**State:** `BudgetViewModel` owns `selectedBikeId`, `activeTier`, `enabledGear: Set<String>`, `expandedGear: Set<String>`

---

### 7.9 Trip Planner Tab

**Hero:** map icon + "Trip Planner" title + description

**Search card:**
- `TextField` for destination
- Radius chip row: `HStack` of `FilterChipView` for 5km / 10km / 20km / 50km
- "Search" button → calls `TripPlannerViewModel.search(destination:radius:)`

**Map:**
- `Map` (MapKit SwiftUI)
- Show `MapAnnotation` pins for origin + each shop result
- Tap pin → callout with shop name/hours

**Shop results list:**
- `LazyVStack` of `ShopCardView`:
  - Name + "Bike Shop" or "Hire / Rental" badge
  - Address + distance (km)
  - Phone (tappable `tel:` link using `openURL`)
  - Website (tappable link)
  - Hours
  - "Get Directions →" → opens Apple Maps or Google Maps
- Fallback card if no results: links to Google Maps search

**TripPlannerViewModel:**

```swift
class TripPlannerViewModel: ObservableObject {
    @Published var shops: [BikeShop] = []
    @Published var region: MKCoordinateRegion = .init()
    @Published var isLoading = false
    @Published var errorMessage: String?

    func search(destination: String, radiusMetres: Int) async {
        // 1. Geocode destination → lat/lon via Nominatim
        // 2. Query Overpass API for bicycle shops + rentals within radius
        // 3. Deduplicate + sort by distance
        // 4. Update shops + region on MainActor
    }
}
```

**BikeShop model:**
```swift
struct BikeShop: Identifiable {
    let id: String
    let name: String
    let type: ShopType       // .shop or .hire
    let coordinate: CLLocationCoordinate2D
    let address: String?
    let phone: String?
    let website: String?
    let hours: String?
    var distanceKm: Double?
}
```

**API calls (no auth needed):**

Nominatim geocoding:
```
GET https://nominatim.openstreetmap.org/search?q={destination}&format=json&limit=1
```

Overpass (bicycle shops + rentals):
```
[out:json][timeout:10];
(
  node["shop"="bicycle"](around:{radius},{lat},{lon});
  node["amenity"="bicycle_rental"](around:{radius},{lat},{lon});
);
out body;
```

Add `User-Agent` header to all OSM requests (required by OSM policy).

---

### 7.10 Rider Profiles Modal

Accessible via a toolbar button (person icon) shown in Results + Search tabs.

- Shows all saved `RiderProfile` from SwiftData
- Tap profile card → sets `isActive = true` on that profile, false on others
- "+" button → sheet with profile creation form (name, age, height, experience, style, avatar photo picker)
- Swipe to delete → removes from SwiftData
- Active profile shown with orange ring / checkmark

---

### 7.11 Bike Quiz Sheet

Presented as `.sheet` from "🎮 Quiz" button on any bike card.

- Shows bike image + name header
- Generates 6 random questions from `GAME_Q_TEMPLATES` applicable to that bike
- Each question: question text + 4 answer buttons
- Tap answer → immediate colour feedback (green correct, red wrong)
- Progress bar at top
- Final score screen: emoji rank + points + "Play Again" / "Done"

**Question generation logic:**
- Pick up to 6 eligible question types for the bike (skip shock for hardtails, skip motor for non-eBikes, etc.)
- For each question, generate 3–4 distractors by sampling the same field from other `BIKES`
- Shuffle answer options

---

## 8. Shared Components

Build these reusable components:

| Component | Usage |
|-----------|-------|
| `FilterChipView` | Brand/travel/wheel/radius chips throughout |
| `StatCardView` | 4 stats on Search tab |
| `PriceRowView` | Retailer + price + badge row in bike cards |
| `SpecPillView` | Wheel/travel/category/frame pills |
| `SectionHeader` | Orange header bar used on multiple sections |
| `BadgeView` | BEST / LOW / HIGH / OOS / AU / INTL tags |
| `FitStripView` | Green/orange/red fit indicator below bike cards |
| `PriceChartView` | 7-day bar chart in Watchlist |

---

## 9. State Management Summary

| State | Where | How |
|-------|-------|-----|
| Active filters | `FilterState` (@EnvironmentObject) | `@Published` sets/strings |
| Compare selection | `AppState` (@EnvironmentObject) | `@Published var compareSet: Set<Int>` (max 3) |
| Active tab | `AppState` | `@Published var activeTab: Tab` |
| Budget state | `BudgetViewModel` (@StateObject) | Published properties |
| Trip Planner state | `TripPlannerViewModel` (@StateObject) | Published properties |
| Rider profiles | SwiftData | `@Query var profiles: [RiderProfile]` |
| Watchlist | SwiftData | `@Query var watchlist: [WatchlistItem]` |
| Favourites | SwiftData | Flag on `WatchlistItem` |

`filteredBikes` is a **computed property** on `FilterState`:

```swift
var filteredBikes: [Bike] {
    BIKES.filter { bike in
        matchesText(bike) &&
        matchesCategory(bike) &&
        matchesWheel(bike) &&
        matchesBudget(bike) &&
        matchesBrands(bike) &&
        matchesTravel(bike) &&
        matchesProfile(bike)
    }
}
```

---

## 10. Persistence

| Data | Storage | Key |
|------|---------|-----|
| Rider profiles | SwiftData `RiderProfile` | — |
| Watchlist | SwiftData `WatchlistItem` | — |
| Favourites | SwiftData (flag on WatchlistItem) | — |
| Bike/retailer data | Hardcoded Swift arrays | — |

No server, no API keys, no auth. Fully offline except Trip Planner.

---

## 11. Build Order (Recommended Sequence)

1. **Project setup** + Theme.swift + Color extension
2. **Data files** — transcribe all bikes, retailers, gear items, quotes from HTML
3. **Models** — Bike, Retailer, GearItem structs + SwiftData models
4. **AppState + FilterState** — shared environment objects
5. **ContentView** — TabView skeleton (7 empty tabs)
6. **BikeCardView** — the most reused component; build it first
7. **Results tab** — grid + filtering (uses BikeCardView)
8. **Search tab** — filters feed into FilterState → Results
9. **Compare tab** — uses compareSet from AppState
10. **Watchlist tab** — SwiftData queries
11. **Sizing tab** — SizingHelper + static charts
12. **Budget tab** — BudgetViewModel + gear list
13. **Trip Planner tab** — API calls + MapKit
14. **Bike Detail Sheet** — used from Results + Compare
15. **Quiz Sheet** — game logic
16. **Rider Profiles modal** — SwiftData CRUD
17. **Polish** — animations, empty states, error states, haptics

---

## 12. iOS-Specific Adaptations

| Web behaviour | iOS equivalent |
|---------------|----------------|
| Tab navigation | `TabView` |
| Modal dialogs | `.sheet` / `.fullScreenCover` |
| Hover states | `.buttonStyle` press animations |
| `localStorage` | SwiftData |
| `window.open()` / links | `openURL` environment value |
| Leaflet map | `Map` (MapKit SwiftUI) |
| CSS grid | `LazyVGrid` / `LazyHStack` |
| Horizontal scroll chips | `ScrollView(.horizontal)` + `HStack` |
| `alert()` / `confirm()` | `.alert` modifier |
| File input (avatar) | `PhotosPicker` (`PhotosUI`) |
| `tel:` links | `openURL` with `tel://` scheme |

---

## 13. Minimum Viable Version (if scope is too large)

If you need to ship a focused v1, implement in this order and defer the rest:

**Must have (v1):**
- Search + filter
- Results grid with bike cards
- Bike detail sheet
- Watchlist (add/remove/favourites)
- Rider profile (one active profile)

**Defer to v2:**
- Compare tab
- Quiz game
- Sizing tab
- Budget tab
- Trip Planner (requires OSM API)
- Multi-profile system

---

## 14. Notes

- All prices in AUD. Format with `NumberFormatter` in `.currency` style, locale `en_AU`.
- Images: bikes don't have real image URLs — use the branded placeholder logic (brand color + bike emoji + model name label) as a `ZStack` with `RoundedRectangle` background.
- Retailer search URLs: replicate the per-retailer URL builder functions from the HTML's `RETAILERS` array — some use Shopify search, some CRC custom paths, etc. Check each one carefully.
- "Out of stock" logic: a bike is OOS at a retailer when the retailer ID is in `bike.prices` but NOT in `bike.inStock`.
- The compare float bar should float above the tab bar using `.overlay(alignment: .bottom)` on the TabView or NavigationStack.
