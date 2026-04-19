import SwiftUI
import SwiftData
import Combine

struct WatchlistView: View {
    @Query private var watchlistItems: [WatchlistItem]
    @EnvironmentObject private var filterStore: FilterStore
    @Environment(\.modelContext) private var modelContext
    @State private var editingItem: EditingTarget?
    @State private var targetPriceText: String = ""
    @State private var pendingDeletion: WatchlistItem?
    @State private var recentlyDeleted: DeletedWatchlistSnapshot?
    @EnvironmentObject private var appState: AppState
    @State private var selectedBike: Bike?

    var body: some View {
        NavigationStack {
            List {
                Section("Watch Alerts") {
                    if alertItems.isEmpty {
                        Text("No active alerts yet. Set target prices to get notified when bikes drop below your target.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(alertItems, id: \.persistentModelID) { item in
                            if let bike = bike(for: item) {
                                Button {
                                    selectedBike = bike
                                } label: {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text("\(bike.brand) \(bike.model)")
                                                .font(.subheadline.weight(.semibold))
                                                .foregroundStyle(.primary)
                                            Text("Best \(Formatting.currency(bike.bestPrice)) · Target \(Formatting.currency(item.targetPrice))")
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                        }
                                        Spacer()
                                        Image(systemName: "bell.badge.fill")
                                            .foregroundStyle(Color.rOrange)
                                    }
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }

                Section("All Watched Bikes") {
                    if watchlistItems.isEmpty {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("No bikes in your watchlist yet.")
                                .font(.subheadline.weight(.semibold))
                            Text("Tap the bell icon on any bike card to start tracking price changes.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Button {
                                appState.activeTab = .results
                            } label: {
                                Label("Browse Bikes", systemImage: "list.bullet")
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(Color.rOrange)
                            .padding(.top, 2)
                        }
                        .padding(.vertical, 6)
                    } else {
                        ForEach(sortedItems, id: \.persistentModelID) { item in
                            if let bike = bike(for: item) {
                                VStack(alignment: .leading, spacing: 8) {
                                    Button {
                                        selectedBike = bike
                                    } label: {
                                        HStack(alignment: .top) {
                                            VStack(alignment: .leading, spacing: 3) {
                                                Text("\(bike.brand) \(bike.model)")
                                                    .font(.headline)
                                                    .foregroundStyle(.primary)
                                                Text("Best: \(Formatting.currency(bike.bestPrice))")
                                                    .font(.subheadline.weight(.semibold))
                                                    .foregroundStyle(Color.rGreen)
                                                Text("Target: \(Formatting.currency(item.targetPrice))")
                                                    .font(.caption)
                                                    .foregroundStyle(.secondary)
                                            }
                                            Spacer()
                                            Image(systemName: "chevron.right")
                                                .font(.caption.weight(.semibold))
                                                .foregroundStyle(.secondary)
                                        }
                                    }
                                    .buttonStyle(.plain)

                                    if !item.priceHistory.isEmpty {
                                        HStack(alignment: .lastTextBaseline, spacing: 8) {
                                            Text("History")
                                                .font(.caption.weight(.semibold))
                                                .foregroundStyle(.secondary)
                                            sparkline(values: item.priceHistory)
                                            Spacer()
                                            Text(historyDeltaLabel(for: item.priceHistory))
                                                .font(.caption2.weight(.semibold))
                                                .foregroundStyle(historyDeltaColor(for: item.priceHistory))
                                        }
                                    }

                                    HStack {
                                        Button("Update Target") {
                                            editingItem = EditingTarget(id: item.persistentModelID)
                                            targetPriceText = String(Int(item.targetPrice))
                                        }
                                        .buttonStyle(.bordered)

                                        Button("Snapshot Price") {
                                            snapshotCurrentPrice(for: item, bike: bike)
                                        }
                                        .buttonStyle(.bordered)

                                        Spacer()

                                        Button(role: .destructive) {
                                            pendingDeletion = item
                                        } label: {
                                            Text("Remove")
                                        }
                                        .buttonStyle(.borderless)
                                    }
                                }
                                .padding(.vertical, 4)
                            }
                        }
                        .onDelete(perform: deleteItems)
                    }
                }
            }
            .listStyle(.plain)
            .navigationTitle("Watchlist")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(item: $editingItem) { editing in
                NavigationStack {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Update Target Price")
                            .font(.headline)
                        TextField("Target price (AUD)", text: $targetPriceText)
                            .textFieldStyle(.roundedBorder)
                            .keyboardType(.numberPad)
                            .onChange(of: targetPriceText) { _, newValue in
                                let digits = newValue.filter(\.isNumber)
                                if digits != newValue { targetPriceText = digits }
                            }
                        Button("Save") {
                            updateTargetPrice(for: editing.id)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(Color.rOrange)
                        Spacer()
                    }
                    .padding()
                    .navigationTitle("Target")
                }
            }
            .alert(
                "Remove bike from watchlist?",
                isPresented: Binding(
                    get: { pendingDeletion != nil },
                    set: { if !$0 { pendingDeletion = nil } }
                ),
                presenting: pendingDeletion
            ) { item in
                Button("Cancel", role: .cancel) {}
                Button("Remove", role: .destructive) {
                    removeItem(item)
                }
            } message: { item in
                if let bike = bike(for: item) {
                    Text("Remove \(bike.brand) \(bike.model) from your watchlist?")
                } else {
                    Text("Remove this bike from your watchlist?")
                }
            }
            .sheet(item: $selectedBike) { bike in
                BikeDetailView(bike: bike)
            }
            .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
                snapshotAllPrices()
            }
            .safeAreaInset(edge: .bottom) {
                if let recentlyDeleted {
                    HStack {
                        Text("Removed from watchlist")
                            .font(.caption.weight(.semibold))
                        Spacer()
                        Button("Undo") {
                            restoreDeletedItem(recentlyDeleted)
                            self.recentlyDeleted = nil
                        }
                        .font(.caption.weight(.semibold))
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(.thinMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .padding(.horizontal, 12)
                    .padding(.bottom, 8)
                }
            }
        }
    }

    private var sortedItems: [WatchlistItem] {
        watchlistItems.sorted { lhs, rhs in
            if lhs.isFavourite == rhs.isFavourite {
                return lhs.addedAt > rhs.addedAt
            }
            return lhs.isFavourite && !rhs.isFavourite
        }
    }

    private var alertItems: [WatchlistItem] {
        sortedItems.filter { item in
            guard let current = bike(for: item)?.bestPrice else { return false }
            return current <= item.targetPrice
        }
    }

    private func bike(for item: WatchlistItem) -> Bike? {
        filterStore.catalog.first(where: { $0.id == item.bikeId })
    }

    private func deleteItems(at offsets: IndexSet) {
        let items = offsets.map { sortedItems[$0] }
        for item in items {
            removeItem(item)
        }
    }

    private func removeItem(_ item: WatchlistItem) {
        recentlyDeleted = DeletedWatchlistSnapshot(
            bikeId: item.bikeId,
            addedAt: item.addedAt,
            targetPrice: item.targetPrice,
            priceHistory: item.priceHistory,
            isFavourite: item.isFavourite
        )
        modelContext.delete(item)
        pendingDeletion = nil
    }

    private func restoreDeletedItem(_ snapshot: DeletedWatchlistSnapshot) {
        let restored = WatchlistItem(
            bikeId: snapshot.bikeId,
            targetPrice: snapshot.targetPrice,
            priceHistory: snapshot.priceHistory,
            isFavourite: snapshot.isFavourite
        )
        restored.addedAt = snapshot.addedAt
        modelContext.insert(restored)
    }

    private func snapshotCurrentPrice(for item: WatchlistItem, bike: Bike) {
        if let best = bike.bestPrice {
            item.priceHistory.append(best)
            if item.priceHistory.count > 20 {
                item.priceHistory = Array(item.priceHistory.suffix(20))
            }
        }
    }

    private func snapshotAllPrices() {
        for item in watchlistItems {
            guard let bike = bike(for: item) else { continue }
            snapshotCurrentPrice(for: item, bike: bike)
        }
    }

    private func updateTargetPrice(for id: PersistentIdentifier) {
        guard let item = watchlistItems.first(where: { $0.persistentModelID == id }),
              let target = Double(targetPriceText) else { return }
        item.targetPrice = target
        editingItem = nil
    }

    private func historyDeltaLabel(for values: [Double]) -> String {
        guard let first = values.first, let last = values.last else { return "No change" }
        let delta = last - first
        let sign = delta > 0 ? "+" : ""
        return "\(sign)\(Int(delta))"
    }

    private func historyDeltaColor(for values: [Double]) -> Color {
        guard let first = values.first, let last = values.last else { return .secondary }
        if last < first { return Color.rGreen }
        if last > first { return Color.rRed }
        return .secondary
    }

    @ViewBuilder
    private func sparkline(values: [Double]) -> some View {
        let trimmed = Array(values.suffix(12))
        let maxValue = trimmed.max() ?? 1
        let minValue = trimmed.min() ?? 0
        let avg = trimmed.reduce(0, +) / Double(max(1, trimmed.count))
        let range = max(avg * 0.05, maxValue - minValue, 1)
        HStack(alignment: .bottom, spacing: 2) {
            ForEach(Array(trimmed.enumerated()), id: \.offset) { _, value in
                let normalized = (value - minValue) / range
                RoundedRectangle(cornerRadius: 2)
                    .fill(Color.rBlue)
                    .frame(width: 5, height: max(6, 22 * normalized))
            }
        }
        .frame(height: 24)
    }

    private struct EditingTarget: Identifiable {
        let id: PersistentIdentifier
    }

    private struct DeletedWatchlistSnapshot {
        let bikeId: Int
        let addedAt: Date
        let targetPrice: Double
        let priceHistory: [Double]
        let isFavourite: Bool
    }
}
