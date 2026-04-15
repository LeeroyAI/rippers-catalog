import Foundation

public struct CatalogSnapshot: Codable, Sendable {
    public let bikes: [BikeRecord]
    public let sourceID: String
    public let savedAt: Date
}

public struct CatalogRefreshResult: Sendable {
    public let bikes: [Bike]
    public let sourceID: String
    public let audits: [CatalogAuditRecord]
    public let refreshedAt: Date
}

public actor BikeCatalogRepository {
    private let providers: [any BikeCatalogProvider]
    private let cacheURL: URL

    public init(providers: [any BikeCatalogProvider], cacheFilename: String = "catalog-cache-v1.json") {
        self.providers = providers
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first
        self.cacheURL = (caches ?? URL(fileURLWithPath: NSTemporaryDirectory())).appendingPathComponent(cacheFilename)
    }

    public func loadCached(maxAgeMinutes: Int? = nil) -> CatalogRefreshResult? {
        guard let data = try? Data(contentsOf: cacheURL),
              let snapshot = try? JSONDecoder().decode(CatalogSnapshot.self, from: data) else {
            return nil
        }
        if let maxAgeMinutes {
            let age = Date().timeIntervalSince(snapshot.savedAt)
            if age > Double(maxAgeMinutes * 60) {
                return nil
            }
        }
        let bikes = snapshot.bikes.map(\.bike)
        return CatalogRefreshResult(
            bikes: bikes,
            sourceID: snapshot.sourceID,
            audits: CatalogValidator.validate(sourceID: snapshot.sourceID, bikes: bikes),
            refreshedAt: snapshot.savedAt
        )
    }

    public func refresh() async -> CatalogRefreshResult {
        for provider in providers where provider.source.enabled {
            do {
                let payload = try await provider.fetchCatalog()
                let criticals = payload.audits.filter { $0.severity == .critical }
                if !criticals.isEmpty { continue }

                saveSnapshot(bikes: payload.bikes, sourceID: payload.source.id, savedAt: payload.fetchedAt)
                return CatalogRefreshResult(
                    bikes: payload.bikes,
                    sourceID: payload.source.id,
                    audits: payload.audits,
                    refreshedAt: payload.fetchedAt
                )
            } catch {
                continue
            }
        }

        if let cached = loadCached() {
            return CatalogRefreshResult(
                bikes: cached.bikes,
                sourceID: "\(cached.sourceID)-cache",
                audits: cached.audits,
                refreshedAt: cached.refreshedAt
            )
        }

        let fallback = BIKES
        return CatalogRefreshResult(
            bikes: fallback,
            sourceID: "hard-fallback",
            audits: CatalogValidator.validate(sourceID: "hard-fallback", bikes: fallback),
            refreshedAt: .now
        )
    }

    private func saveSnapshot(bikes: [Bike], sourceID: String, savedAt: Date) {
        let payload = CatalogSnapshot(
            bikes: bikes.map(BikeRecord.init),
            sourceID: sourceID,
            savedAt: savedAt
        )
        guard let data = try? JSONEncoder().encode(payload) else { return }
        try? data.write(to: cacheURL, options: .atomic)
    }
}
