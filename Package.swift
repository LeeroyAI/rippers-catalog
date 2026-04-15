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
        .target(name: "RippersCore")
    ]
)
