import Foundation
import SwiftUI

public enum AppTab: Hashable {
    case search
    case results
    case compare
    case watchlist
    case help
    case sizing
    case budget
    case trip
}

public final class AppState: ObservableObject {
    @Published public var activeTab: AppTab = .search
    @Published public var compareSet: Set<Int> = []

    public init() {}

    public func toggleCompare(_ bikeId: Int) {
        if compareSet.contains(bikeId) {
            compareSet.remove(bikeId)
            return
        }
        guard compareSet.count < 3 else { return }
        compareSet.insert(bikeId)
    }
}

public final class FilterStore: ObservableObject {
    @Published public var state: FilterState = .init()
    @Published public var catalog: [Bike] = BIKES

    public init() {}

    public struct ActiveFilterToken: Identifiable {
        public let id: String
        public let label: String
        public let remove: (inout FilterState) -> Void
    }

    public var filteredBikes: [Bike] {
        BikeFilterEngine.apply(bikes: catalog, filters: state)
    }

    public var rankedBikes: [(bike: Bike, score: Int)] {
        BikeFilterEngine.rank(bikes: filteredBikes, filters: state)
    }

    public var activeFilterTokens: [ActiveFilterToken] {
        var tokens: [ActiveFilterToken] = []

        if !state.searchText.isEmpty {
            tokens.append(.init(id: "search", label: "\"\(state.searchText)\"", remove: { $0.searchText = "" }))
        }
        if state.category != "Any" {
            tokens.append(.init(id: "category", label: state.category, remove: { $0.category = "Any" }))
        }
        if state.wheel != "Any" {
            tokens.append(.init(id: "wheel", label: state.wheel, remove: { $0.wheel = "Any" }))
        }
        if let maxBudget = state.maxBudget {
            tokens.append(.init(id: "budget", label: "Under \(Int(maxBudget))", remove: { $0.maxBudget = nil }))
        }
        for brand in state.activeBrands.sorted() {
            tokens.append(.init(id: "brand-\(brand)", label: brand, remove: { $0.activeBrands.remove(brand) }))
        }
        if state.activeEbikeFilter && state.activeEbikeBrandFilters.isEmpty {
            tokens.append(.init(id: "ebikes-only", label: "⚡ eBikes only", remove: { $0.activeEbikeFilter = false }))
        }
        for brand in state.activeEbikeBrandFilters.sorted() {
            tokens.append(.init(id: "ebike-brand-\(brand)", label: "⚡ \(brand)", remove: { state in
                state.activeEbikeBrandFilters.remove(brand)
                if state.activeEbikeBrandFilters.isEmpty { state.activeEbikeFilter = false }
            }))
        }
        for travel in state.activeTravelRanges.sorted() {
            tokens.append(.init(id: "travel-\(travel)", label: travel, remove: { $0.activeTravelRanges.remove(travel) }))
        }
        return tokens
    }

    public func removeToken(_ token: ActiveFilterToken) {
        token.remove(&state)
    }
}

@MainActor
public final class CatalogStore: ObservableObject {
    @Published public private(set) var bikes: [Bike] = BIKES
    @Published public private(set) var lastUpdated: Date?
    @Published public private(set) var sourceID: String = "embedded-static"
    @Published public private(set) var sourceStatus: String = "Static fallback"
    @Published public private(set) var fallbackReason: String?
    @Published public private(set) var lastSuccessfulLiveSource: String?
    @Published public private(set) var isRefreshing: Bool = false
    @Published public private(set) var hasCriticalAudits: Bool = false

    private let flags: CatalogFeatureFlags
    private let repository: BikeCatalogRepository

    public init(flags: CatalogFeatureFlags = .current) {
        self.flags = flags
        self.repository = CatalogStore.makeRepository()
    }

    public var liveCatalogEnabled: Bool { flags.useLiveCatalog }
    public var brandedUIEnabled: Bool { flags.useBrandedUIV2 }
    public var freshnessTTLMinutes: Int { 60 }

    public func bootstrap() async {
        if let cached = await repository.loadCached(maxAgeMinutes: freshnessTTLMinutes) {
            bikes = cached.bikes
            sourceID = cached.sourceID
            lastUpdated = cached.refreshedAt
            sourceStatus = "Cached snapshot"
            fallbackReason = nil
            hasCriticalAudits = cached.audits.contains(where: { $0.severity == .critical })
        } else if let staleCached = await repository.loadCached() {
            bikes = staleCached.bikes
            sourceID = "\(staleCached.sourceID)-stale-cache"
            lastUpdated = staleCached.refreshedAt
            sourceStatus = "Stale cached snapshot"
            fallbackReason = "Cache is older than \(freshnessTTLMinutes) minutes; refreshing live."
            hasCriticalAudits = staleCached.audits.contains(where: { $0.severity == .critical })
        } else {
            bikes = BIKES
            sourceID = "embedded-static"
            lastUpdated = .now
            sourceStatus = "Static fallback"
            fallbackReason = "No cached snapshot available."
            hasCriticalAudits = false
        }

        guard flags.useLiveCatalog else { return }
        await refresh()
    }

    @discardableResult
    public func refresh(requireLiveResult: Bool = false) async -> Bool {
        guard !isRefreshing else { return false }
        isRefreshing = true
        defer { isRefreshing = false }

        guard flags.useLiveCatalog else { return false }
        let result = await repository.refresh()
        bikes = result.bikes
        sourceID = result.sourceID
        lastUpdated = result.refreshedAt
        hasCriticalAudits = result.audits.contains(where: { $0.severity == .critical })
        if sourceID.contains("cache") {
            sourceStatus = "Cached fallback"
            fallbackReason = "Live source fetch failed, using cached snapshot."
        } else if sourceID.contains("public-feed") || sourceID.contains("official") {
            sourceStatus = hasCriticalAudits ? "Live source (audit warning)" : "Live source"
            fallbackReason = hasCriticalAudits ? "Live payload failed quality audit checks." : nil
            lastSuccessfulLiveSource = sourceID
        } else if sourceID == "bundle-catalog" {
            sourceStatus = "Bundled live fallback"
            fallbackReason = "Remote feed unavailable, using bundled catalog snapshot."
        } else {
            sourceStatus = "Static fallback"
            fallbackReason = "Live and cache unavailable."
        }

        if requireLiveResult && sourceStatus != "Live source" {
            fallbackReason = "Live search unavailable right now. Showing best available cached/static results."
        }
        return sourceStatus == "Live source"
    }

    private static func makeRepository() -> BikeCatalogRepository {
        var providers: [any BikeCatalogProvider] = PublicCatalogSources.sources.map { source in
            PublicJSONCatalogProvider(source: source)
        }
        providers.append(BundledCatalogProvider())
        providers.append(StaticCatalogProvider(source: PublicCatalogSources.staticFallback, bikes: BIKES))
        return BikeCatalogRepository(providers: providers, cacheFilename: "rippers-live-catalog-cache.json")
    }
}

private struct BundledCatalogProvider: BikeCatalogProvider {
    let source = CatalogSource(
        id: "bundle-catalog",
        name: "Bundled catalog snapshot",
        type: .staticFallback,
        endpoint: nil,
        ttlSeconds: 0,
        enabled: true
    )

    func fetchCatalog() async throws -> CatalogFetchPayload {
        guard let url = Bundle.main.url(forResource: "catalog", withExtension: "json"),
              let data = try? Data(contentsOf: url) else {
            throw NSError(domain: "Catalog", code: 12, userInfo: [NSLocalizedDescriptionKey: "Bundled catalog not found"])
        }
        let bikes = try JSONDecoder().decode([BikeRecord].self, from: data).map(\.bike)
        guard !bikes.isEmpty else {
            throw NSError(domain: "Catalog", code: 13, userInfo: [NSLocalizedDescriptionKey: "Bundled catalog is empty"])
        }
        let audits = CatalogValidator.validate(sourceID: source.id, bikes: bikes)
        return CatalogFetchPayload(source: source, bikes: bikes, audits: audits)
    }
}
