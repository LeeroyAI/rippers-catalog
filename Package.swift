// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "RippersCore",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        .library(
            name: "RippersCore",
            targets: ["RippersCore"]
        )
    ],
    targets: [
        .target(
            name: "RippersCore",
            path: "Rippers",
            exclude: [
                "Tests",
                "Budget",
                "Compare",
                "Sizing",
                "TripPlanner",
                "Watchlist",
                "Results",
                "Search/SearchView.swift",
                "Shared/AppState.swift",
                "Shared/BikeCardView.swift",
                "Shared/BrandSystem.swift",
                "Shared/BrandComponents.swift",
                "Shared/SplashView.swift",
                "Shared/Theme.swift",
                "Onboarding",
                "ContentView.swift",
                "RippersApp.swift",
                "Assets.xcassets",
                "catalog.json"
            ]
        )
    ]
)
