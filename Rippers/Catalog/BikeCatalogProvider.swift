import Foundation

public protocol BikeCatalogProvider: Sendable {
    var source: CatalogSource { get }
    func fetchCatalog() async throws -> CatalogFetchPayload
}
