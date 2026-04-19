import SwiftUI
import SwiftData

struct BikeDetailView: View {
    let bike: Bike
    @Environment(\.openURL) private var openURL
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    @EnvironmentObject private var appState: AppState
    @Query private var watchlistItems: [WatchlistItem]

    private var watchlistItem: WatchlistItem? { watchlistItems.first { $0.bikeId == bike.id } }
    private var isWatched: Bool { watchlistItem != nil }
    private var isInCompare: Bool { appState.compareSet.contains(bike.id) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    detailImage
                        .frame(maxHeight: 280)
                        .frame(maxWidth: .infinity)
                        .background(Color.rCard)
                        .clipShape(RoundedRectangle(cornerRadius: 16))

                    VStack(alignment: .leading, spacing: 4) {
                        Text(bike.brand.uppercased())
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Text("\(bike.model) · \(String(bike.year))")
                            .font(.title3.weight(.bold))
                        Text("Best \(Formatting.currency(bike.bestPrice))")
                            .font(.headline.weight(.semibold))
                            .foregroundStyle(Color.rGreen)
                    }

                    Group {
                        DetailRow(label: "Category", value: bike.category)
                        DetailRow(label: "Wheel", value: bike.wheel)
                        DetailRow(label: "Travel", value: bike.travel)
                        DetailRow(label: "Suspension", value: bike.suspension)
                        DetailRow(label: "Frame", value: bike.frame)
                        DetailRow(label: "Drivetrain", value: bike.drivetrain)
                        DetailRow(label: "Fork", value: bike.fork)
                        DetailRow(label: "Shock", value: bike.shock)
                        DetailRow(label: "Brakes", value: bike.brakes)
                        DetailRow(label: "Weight", value: bike.weight)
                        DetailRow(label: "Sizes", value: bike.sizes.joined(separator: ", "))
                    }

                    Text("— indicates spec not available from retailer data")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .padding(.top, 2)

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Retailer Prices")
                            .font(.headline)
                        ForEach(priceRows, id: \.retailer.id) { row in
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(row.retailer.name)
                                        .font(.subheadline.weight(.semibold))
                                    HStack(spacing: 4) {
                                        Text(row.retailer.isAustralian ? "AU" : "INTL")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                        if !bike.inStock.isEmpty && !row.inStock {
                                            Text("Check stock")
                                                .font(.caption2.weight(.semibold))
                                                .foregroundStyle(Color.rYellow)
                                        }
                                    }
                                }
                                Spacer()
                                Text(Formatting.currency(row.price))
                                    .font(.subheadline.weight(.bold))
                                    .foregroundStyle(row.price == bike.bestPrice ? Color.rGreen : .primary)
                                let isVerified = row.retailer.hasVerifiedURL(for: bike)
                                Button(isVerified ? "Deal →" : "Search →") {
                                    if let url = row.retailer.dealURL(for: bike) {
                                        openURL(url)
                                    }
                                }
                                .buttonStyle(.bordered)
                                .tint(isVerified ? Color.rOrange : .secondary)
                            }
                            .padding(10)
                            .background(Color.rCard)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                    }
                }
                .padding()
            }
            .background(Color.rBackground.ignoresSafeArea())
            .navigationTitle("Bike Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Done") { dismiss() }
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        appState.toggleCompare(bike.id)
                    } label: {
                        Image(systemName: isInCompare ? "arrow.left.arrow.right.circle.fill" : "arrow.left.arrow.right.circle")
                    }
                    .tint(isInCompare ? Color.rOrange : .primary)
                    .disabled(!isInCompare && appState.compareSet.count >= 3)
                    .accessibilityLabel(isInCompare ? "Remove from compare" : appState.compareSet.count >= 3 ? "Compare full" : "Add to compare")

                    Button {
                        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                        toggleWatch()
                    } label: {
                        Image(systemName: isWatched ? "bell.fill" : "bell")
                    }
                    .tint(isWatched ? Color.rOrange : .primary)
                    .accessibilityLabel(isWatched ? "Remove from watchlist" : "Add to watchlist")
                }
            }
        }
    }

    @ViewBuilder
    private var detailImage: some View {
        BikeResolvedImageView(
            bike: bike,
            contentMode: .fit,
            imagePadding: EdgeInsets(),
            placeholder: { placeholder }
        )
    }

    private var placeholder: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 16).fill(Color.rOrangeLight)
            VStack {
                Image(systemName: "bicycle")
                    .font(.system(size: 56))
                Text("\(bike.brand) \(bike.model)")
                    .font(.headline)
            }
        }
    }

    private func toggleWatch() {
        if let existing = watchlistItem {
            modelContext.delete(existing)
        } else {
            modelContext.insert(WatchlistItem(
                bikeId: bike.id,
                targetPrice: bike.bestPrice ?? 0,
                priceHistory: [bike.bestPrice ?? 0]
            ))
        }
    }

    private var priceRows: [(retailer: Retailer, price: Double, inStock: Bool)] {
        let hasStockData = !bike.inStock.isEmpty
        return bike.prices
            .compactMap { key, value in
                guard let retailer = RETAILERS.first(where: { $0.id == key }) else { return nil }
                return (retailer, value, bike.inStock.contains(key))
            }
            .sorted { a, b in
                if hasStockData && a.inStock != b.inStock { return a.inStock }
                return a.price < b.price
            }
    }
}

private struct DetailRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack(alignment: .top) {
            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .frame(width: 86, alignment: .leading)
            Text(value.isEmpty ? "—" : value)
                .font(.subheadline)
            Spacer()
        }
        .padding(.vertical, 2)
    }
}
