# Run In Xcode (Simulator)

1. Open `Rippers.xcodeproj` in Xcode.
2. Select the `Rippers` scheme.
3. Choose an iPhone Simulator (for example, iPhone 16).
4. Build and Run (`Cmd+R`).

## Current Build State

- The app shell is implemented in SwiftUI with tabs for Search, Results, Compare, Watchlist, Sizing, Budget, and Trip Planner.
- Core filtering and matching logic is implemented in `Rippers/Search/BikeFilterEngine.swift`.
- Core unit tests pass with `swift test` from the repo root.

## Notes

- `Package.swift` is used for core logic test coverage and excludes app-only SwiftUI files.
- The current bike catalog in `Rippers/Data/Bikes.swift` is starter/sample data.
- For production-accurate behavior, replace sample bikes with verified transcription from `dashboard.html`.
