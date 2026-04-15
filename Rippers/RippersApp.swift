import SwiftUI
import SwiftData

@main
struct RippersApp: App {
    @StateObject private var appState = AppState()
    @StateObject private var filterStore = FilterStore()
    @StateObject private var catalogStore = CatalogStore()

    var sharedModelContainer: ModelContainer = {
        let schema = Schema([WatchlistItem.self, RiderProfile.self])
        let config = ModelConfiguration(isStoredInMemoryOnly: false)
        return try! ModelContainer(for: schema, configurations: [config])
    }()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .environmentObject(filterStore)
                .environmentObject(catalogStore)
        }
        .modelContainer(sharedModelContainer)
    }
}
