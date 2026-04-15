# Rippers

[![Platform](https://img.shields.io/badge/platform-iOS%2017%2B-orange)](#requirements)
[![Swift](https://img.shields.io/badge/Swift-5.10-F05138?logo=swift&logoColor=white)](#requirements)
[![Xcode](https://img.shields.io/badge/Xcode-15%2B-147EFB?logo=xcode&logoColor=white)](#requirements)

Rippers is a SwiftUI iOS app for mountain bike discovery and comparison.  
It helps riders find suitable bikes based on profile, budget, ride style, and destination context.

## Getting Started (60 seconds)

```bash
git clone https://github.com/LeeroyAI/rippers-catalog.git
cd rippers-catalog
open Rippers.xcodeproj
```

Then in Xcode: select `Rippers` scheme -> pick an iPhone simulator -> press `Cmd + R`.

## Highlights

- Rider profile-driven bike matching
- Search and filter flow with saved searches
- Results, comparison, watchlist, and sizing tools
- Trip planner with destination-aware recommendations
- Catalog/repository layer for static and public JSON data sources

## Project Structure

- `Rippers/` — iOS app source (SwiftUI screens, models, shared UI, data)
- `Rippers.xcodeproj/` — Xcode project for running the full app
- `Package.swift` + `Sources/RippersCore/` — lightweight Swift package target for core logic evolution
- `README-RUN-IN-XCODE.md` — quick simulator run notes

## Screenshots

Add app screenshots here once captured from simulator:

- `docs/screenshots/home.png` — Home/Search
- `docs/screenshots/results.png` — Results
- `docs/screenshots/trip-planner.png` — Trip Planner

Example markdown once images are added:

```md
![Home](docs/screenshots/home.png)
![Results](docs/screenshots/results.png)
![Trip Planner](docs/screenshots/trip-planner.png)
```

## Requirements

- macOS with Xcode 15+ (recommended)
- iOS 17+ simulator target
- Swift 5.10 toolchain

## Run the App (Xcode)

1. Open `Rippers.xcodeproj` in Xcode.
2. Select the `Rippers` scheme.
3. Choose an iPhone simulator.
4. Press `Cmd + R` to build and run.

## Command-Line Build (Simulator)

Replace `<simulator-uuid>` with a valid destination from `-showdestinations`.

```bash
xcodebuild -project Rippers.xcodeproj -scheme Rippers -showdestinations
xcodebuild -project Rippers.xcodeproj -scheme Rippers \
  -destination "platform=iOS Simulator,id=<simulator-uuid>" -quiet
```

## Swift Package Notes

The Swift package is intentionally minimal and separate from the app target:

- Package name: `RippersCore`
- Product: `RippersCore` library
- Target: `Sources/RippersCore/`

This keeps package-level work isolated from app-only SwiftUI dependencies.

## Data and Catalog

- App data lives under `Rippers/Data/`
- A JSON catalog file is available at `Rippers/catalog.json`
- Catalog loading behavior is managed via files in `Rippers/Catalog/`

## Contributing

1. Create a feature branch.
2. Keep UI and core logic changes grouped and readable.
3. Verify app build in Xcode before opening a PR.
4. Include a short test plan in PR descriptions.

## License

Add your preferred license in this section (for example, MIT, Apache-2.0, or proprietary).

