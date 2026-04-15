import XCTest
@testable import RippersCore

final class LiveCatalogPipelineTests: XCTestCase {
    func testPublicJSONCatalogProviderParsesFixture() async throws {
        let fixtureURL = fixtureFileURL("sample-live-catalog.json")
        let source = CatalogSource(
            id: "fixture-feed",
            name: "Fixture Feed",
            type: .publicFeed,
            endpoint: fixtureURL,
            ttlSeconds: 600
        )
        let provider = PublicJSONCatalogProvider(source: source)

        let payload = try await provider.fetchCatalog()
        XCTAssertEqual(payload.bikes.count, 2)
        XCTAssertEqual(payload.bikes.map(\.id), [9001, 9002])
    }

    func testCatalogValidatorFlagsUnknownRetailer() {
        let invalidBike = Bike(
            id: 7777,
            brand: "Bad",
            model: "RetailerRef",
            year: 2026,
            category: "Trail",
            wheel: "29\"",
            travel: "140mm",
            suspension: "Full Suspension",
            frame: "Alloy",
            drivetrain: "Shimano",
            fork: "Fox",
            shock: "Fox",
            weight: "14kg",
            brakes: "Shimano",
            description: "Invalid retailer ref",
            sizes: ["M"],
            prices: ["unknown-retailer": 1000],
            wasPrice: nil,
            inStock: ["unknown-retailer"],
            sourceUrl: "https://example.com/invalid",
            isEbike: false
        )

        let audits = CatalogValidator.validate(sourceID: "test", bikes: [invalidBike])
        XCTAssertTrue(audits.contains(where: { $0.severity == .critical }))
    }

    func testRepositoryFallsBackToStaticProvider() async {
        let failingSource = CatalogSource(
            id: "bad-feed",
            name: "Bad Feed",
            type: .publicFeed,
            endpoint: URL(string: "https://invalid.example.com/404.json"),
            ttlSeconds: 600
        )
        let staticSource = CatalogSource(
            id: "static-ok",
            name: "Static",
            type: .staticFallback,
            endpoint: nil,
            ttlSeconds: 0
        )

        let repo = BikeCatalogRepository(providers: [
            PublicJSONCatalogProvider(source: failingSource),
            StaticCatalogProvider(source: staticSource, bikes: BIKES)
        ], cacheFilename: "test-catalog-cache.json")

        let result = await repo.refresh()
        XCTAssertEqual(result.sourceID, "static-ok")
        XCTAssertEqual(result.bikes.count, BIKES.count)
    }

    func testGoldenQueryAgainstLiveFixtureData() async throws {
        let fixtureURL = fixtureFileURL("sample-live-catalog.json")
        let source = CatalogSource(
            id: "fixture-feed",
            name: "Fixture Feed",
            type: .publicFeed,
            endpoint: fixtureURL,
            ttlSeconds: 600
        )
        let provider = PublicJSONCatalogProvider(source: source)
        let payload = try await provider.fetchCatalog()

        var filters = FilterState()
        filters.activeEbikeFilter = true
        let ids = BikeFilterEngine.apply(bikes: payload.bikes, filters: filters).map(\.id)
        XCTAssertEqual(ids, [9002])
    }

    private func fixtureFileURL(_ name: String) -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .appendingPathComponent("Fixtures")
            .appendingPathComponent(name)
    }
}
