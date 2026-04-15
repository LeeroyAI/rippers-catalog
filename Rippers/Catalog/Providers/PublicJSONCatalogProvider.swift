import Foundation

public struct PublicJSONCatalogProvider: BikeCatalogProvider {
    public let source: CatalogSource
    private let session: URLSession

    public init(source: CatalogSource, session: URLSession = .shared) {
        self.source = source
        self.session = session
    }

    public func fetchCatalog() async throws -> CatalogFetchPayload {
        guard let endpoint = source.endpoint else {
            throw NSError(domain: "Catalog", code: 10, userInfo: [NSLocalizedDescriptionKey: "Missing endpoint for source \(source.id)"])
        }

        let (data, response) = try await session.data(from: endpoint)
        if let http = response as? HTTPURLResponse, !(200..<300 ~= http.statusCode) {
            throw NSError(domain: "Catalog", code: 11, userInfo: [NSLocalizedDescriptionKey: "Source \(source.id) returned non-2xx response"])
        }

        let decoded = try JSONDecoder().decode([BikeRecord].self, from: data)
        let bikes = decoded.map(\.bike)
        let audits = CatalogValidator.validate(sourceID: source.id, bikes: bikes)
        return CatalogFetchPayload(source: source, bikes: bikes, audits: audits)
    }
}
