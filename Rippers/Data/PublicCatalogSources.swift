import Foundation

public enum PublicCatalogSources {
    // Expected JSON schema: [BikeRecord] from PublicJSONCatalogProvider.
    // Keep URLs public and CORS-independent since this is a native app.
    public static let sources: [CatalogSource] = [
        CatalogSource(
            id: "rippers-public-feed",
            name: "Rippers Public Feed",
            type: .publicFeed,
            endpoint: URL(string: "https://raw.githubusercontent.com/LeeroyAI/rippers-catalog/main/Rippers/catalog.json"),
            ttlSeconds: 3600,
            enabled: true
        ),
        CatalogSource(
            id: "rippers-official-api",
            name: "Rippers Official API",
            type: .officialAPI,
            endpoint: URL(string: "https://api.rippers.app/v1/catalog"),
            ttlSeconds: 900,
            enabled: false
        )
    ]

    public static let staticFallback = CatalogSource(
        id: "embedded-static",
        name: "Embedded Static Catalog",
        type: .staticFallback,
        endpoint: nil,
        ttlSeconds: 0,
        enabled: true
    )
}
