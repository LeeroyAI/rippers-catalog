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
                        Text("Best \(Formatting.currency(bike.displayBestPrice))")
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
                        if bike.retailerPriceLines.isEmpty {
                            Text("No retailer prices on file for this listing. Try opening the source link from search results, or run a live search again.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        } else {
                            ForEach(bike.retailerPriceLines, id: \.id) { row in
                                HStack {
                                    VStack(alignment: .leading) {
                                        Text(row.displayName)
                                            .font(.subheadline.weight(.semibold))
                                        Text(regionLabel(for: row.retailer))
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    Text(Formatting.currency(row.price))
                                        .font(.subheadline.weight(.bold))
                                    Button("Deal") {
                                        openDealURL(for: row)
                                    }
                                    .buttonStyle(.bordered)
                                }
                                .padding(10)
                                .background(Color.rCard)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                            }
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
                targetPrice: bike.displayBestPrice ?? 0,
                priceHistory: [bike.displayBestPrice ?? 0]
            ))
        }
    }

    private func regionLabel(for retailer: Retailer?) -> String {
        guard let retailer else { return "Listed" }
        return retailer.isAustralian ? "AU" : "INTL"
    }

    private func openDealURL(for row: Bike.RetailerPriceLine) {
        if let retailer = row.retailer, let url = retailer.dealURL(for: bike) {
            openURL(url)
        } else if let url = URL(string: bike.sourceUrl), !bike.sourceUrl.isEmpty {
            openURL(url)
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
