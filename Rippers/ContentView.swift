import SwiftUI
import SwiftData

struct ContentView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var filterStore: FilterStore
    @EnvironmentObject private var catalogStore: CatalogStore
    @Environment(\.modelContext) private var modelContext
    @Query private var profiles: [RiderProfile]
    @Query private var watchlistItems: [WatchlistItem]
    @State private var showSplash = true

    private var activeProfile: RiderProfile? { profiles.first(where: { $0.isActive }) }
    private var activeProfileTag: String { activeProfile?.id.uuidString ?? "" }

    var body: some View {
        ZStack {
            TabView(selection: $appState.activeTab) {
                SearchView()
                    .tabItem { Label("Home", systemImage: "house.fill") }
                    .tag(AppTab.search)
                ResultsView()
                    .tabItem { Label("Results", systemImage: "list.bullet") }
                    .tag(AppTab.results)
                WatchlistView()
                    .tabItem { Label("Watchlist", systemImage: "bell") }
                    .tag(AppTab.watchlist)
                    .badge(watchlistAlertCount > 0 ? watchlistAlertCount : 0)
                CompareView()
                    .tabItem { Label("Compare", systemImage: "arrow.left.arrow.right") }
                    .tag(AppTab.compare)
                ProfileTabView()
                    .tabItem { Label("Profile", systemImage: "person.crop.circle") }
                    .tag(AppTab.profile)
            }
            .tint(Color.rOrange)

            if showSplash {
                SplashView {
                    withAnimation(.easeOut(duration: 0.35)) {
                        showSplash = false
                    }
                }
                    .transition(.opacity)
                    .zIndex(2)
            }
        }
        .task {
            // Configure SwiftData-backed catalog store
            catalogStore.configure(context: modelContext, profileTag: activeProfileTag)
            // Trigger silent daily refresh if profile data is stale
            await silentRefreshIfStale()
        }
        .onChange(of: activeProfile?.id) { _, _ in
            catalogStore.switchProfile(profileTag: activeProfileTag)
            Task { await silentRefreshIfStale() }
        }
        .onChange(of: catalogStore.refreshRequestToken) { _, _ in
            // Manual "Refresh Catalog Now" — run a foreground search
            Task { await silentRefreshIfStale(force: true) }
        }
        .onReceive(catalogStore.$bikes) { bikes in
            filterStore.catalog = bikes
        }
        .fullScreenCover(isPresented: onboardingRequiredBinding) {
            ProfileOnboardingView {
                appState.activeTab = .search
            }
        }
    }

    // Runs a live search for the active profile if data is > 24h old (or force = true).
    // Runs silently — no UI overlay. Results are merged into the catalog automatically.
    private func silentRefreshIfStale(force: Bool = false) async {
        let tag = activeProfileTag
        guard !tag.isEmpty else { return }
        guard force || catalogStore.needsRefresh(profileTag: tag) else { return }

        var state = FilterState()
        if let profile = activeProfile {
            state.tailorToProfile = true
            state.profileCategoryHint = profile.preferredCategory == "Any" ? nil : profile.preferredCategory
            state.profileStyleHint = profile.style
            state.profileBudgetCap = profile.budgetCap > 0 ? profile.budgetCap : nil
        }
        let criteria = LiveSearchCriteria.from(state)
        if let result = try? await LiveSearchService.shared.search(criteria: criteria) {
            catalogStore.save(result.bikes, profileTag: tag)
        }
    }

    private var watchlistAlertCount: Int {
        watchlistItems.filter { item in
            guard let price = filterStore.catalog.first(where: { $0.id == item.bikeId })?.bestPrice else { return false }
            return item.targetPrice > 0 && price <= item.targetPrice
        }.count
    }

    private var onboardingRequiredBinding: Binding<Bool> {
        Binding(
            get: { profiles.isEmpty && !showSplash },
            set: { _ in }
        )
    }
}
