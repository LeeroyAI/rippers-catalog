import Foundation
import SwiftUI
import SwiftData

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
    @Published public var liveResults: [Bike]? = nil
    @Published public var isLiveSearching: Bool = false
    @Published public var liveSearchError: String? = nil
    @Published public var liveResultSource: String? = nil
    @Published public var liveSearchStatus: String = ""
    @Published public var liveSearchQueryDescription: String = ""

    public init() {}

    public struct ActiveFilterToken: Identifiable {
        public let id: String
        public let label: String
        public let remove: (inout FilterState) -> Void
    }

    /// The active bike pool: live search results if available, otherwise the static/live catalog.
    private var activeBikePool: [Bike] { liveResults ?? catalog }

    public var filteredBikes: [Bike] {
        // When live results are loaded, still apply local text/ebike filters
        // but skip catalog-level filters that the API already handled.
        if liveResults != nil {
            var localState = state
            localState.category = "Any"
            localState.wheel = "Any"
            localState.maxBudget = nil
            localState.activeBrands = []
            localState.activeTravelRanges = []
            localState.activeEbikeFilter = false
            localState.tailorToProfile = false
            return BikeFilterEngine.apply(bikes: activeBikePool, filters: localState)
        }
        return BikeFilterEngine.apply(bikes: catalog, filters: state)
    }

    public var rankedBikes: [(bike: Bike, score: Int)] {
        BikeFilterEngine.rank(bikes: filteredBikes, filters: state)
    }

    public func clearLiveResults() {
        liveResults = nil
        liveResultSource = nil
        liveSearchError = nil
        liveSearchStatus = ""
        liveSearchQueryDescription = ""
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
    @Published public private(set) var sourceID: String = "seed"
    @Published public private(set) var sourceStatus: String = "Seed data"
    @Published public private(set) var fallbackReason: String? = nil
    @Published public private(set) var lastSuccessfulLiveSource: String? = nil
    @Published public private(set) var isRefreshing: Bool = false
    @Published public private(set) var hasCriticalAudits: Bool = false
    // Incremented when a manual refresh is requested via refresh() — ContentView observes this.
    @Published public private(set) var refreshRequestToken: Int = 0

    public var liveCatalogEnabled: Bool { true }
    public var brandedUIEnabled: Bool { false }
    public var freshnessTTLMinutes: Int { 1440 }    // 24h expressed as minutes

    private var modelContext: ModelContext?
    private var currentProfileTag: String = ""

    public init() {}

    // MARK: - Setup

    public func configure(context: ModelContext, profileTag: String) {
        modelContext = context
        currentProfileTag = profileTag
        seedIfNeeded()
        reloadBikes()
    }

    public func switchProfile(profileTag: String) {
        currentProfileTag = profileTag
        reloadBikes()
    }

    // MARK: - Live search persistence

    public func save(_ newBikes: [Bike], profileTag: String) {
        guard let ctx = modelContext, !profileTag.isEmpty else { return }
        let now = Date()
        for bike in newBikes {
            let id = bike.id
            let desc = FetchDescriptor<CachedBike>(predicate: #Predicate<CachedBike> {
                $0.bikeId == id && $0.profileTag == profileTag
            })
            let existing = (try? ctx.fetch(desc)) ?? []
            existing.forEach { ctx.delete($0) }
            ctx.insert(CachedBike(record: BikeRecord(bike), profileTag: profileTag, fetchedAt: now))
        }
        try? ctx.save()
        reloadBikes()
        lastUpdated = now
    }

    // MARK: - Staleness check

    public func needsRefresh(profileTag: String) -> Bool {
        guard let ctx = modelContext, !profileTag.isEmpty else { return false }
        let desc = FetchDescriptor<CachedBike>(predicate: #Predicate<CachedBike> {
            $0.profileTag == profileTag
        })
        let items = (try? ctx.fetch(desc)) ?? []
        guard !items.isEmpty else { return true }
        let oldest = items.min(by: { $0.fetchedAt < $1.fetchedAt })?.fetchedAt ?? .distantPast
        return Date().timeIntervalSince(oldest) > 86400
    }

    // MARK: - Manual refresh trigger (ContentView observes refreshRequestToken)

    @discardableResult
    public func refresh(requireLiveResult: Bool = false) async -> Bool {
        refreshRequestToken += 1
        return true
    }

    // MARK: - Seeding & loading

    private func seedIfNeeded() {
        guard let ctx = modelContext else { return }
        let desc = FetchDescriptor<CachedBike>(predicate: #Predicate<CachedBike> { $0.profileTag == "" })
        let count = (try? ctx.fetchCount(desc)) ?? 0
        guard count == 0 else { return }
        for bike in BIKES {
            ctx.insert(CachedBike(record: BikeRecord(bike), profileTag: "", fetchedAt: .distantPast))
        }
        try? ctx.save()
    }

    private func reloadBikes() {
        guard let ctx = modelContext else { return }

        let seedDesc = FetchDescriptor<CachedBike>(predicate: #Predicate<CachedBike> { $0.profileTag == "" })
        let seeds = (try? ctx.fetch(seedDesc))?.compactMap(\.bike) ?? []

        var profileBikes: [Bike] = []
        let tag = currentProfileTag
        if !tag.isEmpty {
            let profDesc = FetchDescriptor<CachedBike>(predicate: #Predicate<CachedBike> { $0.profileTag == tag })
            profileBikes = (try? ctx.fetch(profDesc))?.compactMap(\.bike) ?? []
        }

        // Profile bikes take priority over seeds for the same bikeId
        var seenIds = Set<Int>()
        var merged: [Bike] = []
        for bike in profileBikes where seenIds.insert(bike.id).inserted { merged.append(bike) }
        for bike in seeds where seenIds.insert(bike.id).inserted { merged.append(bike) }

        bikes = merged
        if lastUpdated == nil { lastUpdated = .now }

        let hasProfileData = !profileBikes.isEmpty
        sourceID = hasProfileData ? "live-cache" : "seed"
        sourceStatus = hasProfileData ? "Live source" : "Seed data"
        fallbackReason = hasProfileData ? nil : "Run a live search to build your profile's bike library."
    }

    // Legacy no-op kept for any callers not yet migrated
    public func bootstrap() async {}
}
