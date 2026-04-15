import SwiftUI
import SwiftData

struct ContentView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var filterStore: FilterStore
    @EnvironmentObject private var catalogStore: CatalogStore
    @Query private var profiles: [RiderProfile]
    @State private var showSplash = true

    var body: some View {
        ZStack {
            TabView(selection: $appState.activeTab) {
                SearchView()
                    .tabItem { Label("Home", systemImage: "house.fill") }
                    .tag(AppTab.search)
                ResultsView()
                    .tabItem { Label("Results", systemImage: "list.bullet") }
                    .tag(AppTab.results)
                CompareView()
                    .tabItem { Label("Compare", systemImage: "arrow.left.arrow.right") }
                    .tag(AppTab.compare)
                WatchlistView()
                    .tabItem { Label("Watchlist", systemImage: "bell") }
                    .tag(AppTab.watchlist)
                HelpView()
                    .tabItem { Label("Help", systemImage: "questionmark.circle") }
                    .tag(AppTab.help)
                SizingView()
                    .tabItem { Label("Sizing", systemImage: "ruler") }
                    .tag(AppTab.sizing)
                BudgetView()
                    .tabItem { Label("Budget", systemImage: "dollarsign.circle") }
                    .tag(AppTab.budget)
                TripPlannerView()
                    .tabItem { Label("Trip", systemImage: "map") }
                    .tag(AppTab.trip)
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
            await catalogStore.bootstrap()
            filterStore.catalog = catalogStore.bikes
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

    private var onboardingRequiredBinding: Binding<Bool> {
        Binding(
            get: { profiles.isEmpty && !showSplash },
            set: { _ in }
        )
    }
}
