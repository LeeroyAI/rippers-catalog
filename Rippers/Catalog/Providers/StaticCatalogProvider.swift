import Foundation

public struct StaticCatalogProvider: BikeCatalogProvider {
    public let source: CatalogSource
    private let bikes: [Bike]

    public init(source: CatalogSource, bikes: [Bike]) {
        self.source = source
        self.bikes = bikes
    }

    public func fetchCatalog() async throws -> CatalogFetchPayload {
        let audits = CatalogValidator.validate(sourceID: source.id, bikes: bikes)
        return CatalogFetchPayload(source: source, bikes: bikes, audits: audits)
    }
}
