import SwiftUI

struct CompareView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var filterStore: FilterStore

    private var compared: [Bike] {
        // Check live results first, then fall back to catalog
        let pool = (filterStore.liveResults ?? []) + filterStore.catalog
        var seen = Set<Int>()
        return pool.filter { appState.compareSet.contains($0.id) && seen.insert($0.id).inserted }
    }

    var body: some View {
        NavigationStack {
            if compared.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "arrow.left.arrow.right")
                        .font(.system(size: 44, weight: .light))
                        .foregroundStyle(Color.rOrange)
                    Text("No Bikes Selected")
                        .font(.title3.weight(.semibold))
                    Text("Select up to 3 bikes in Results to compare side-by-side.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                    Button {
                        appState.activeTab = .results
                    } label: {
                        Label("Browse Results", systemImage: "list.bullet")
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Color.rOrange)
                }
                .padding(32)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        Text("Head-to-head comparison")
                            .font(.headline)

                        bikeHeroRow

                        sectionTitle("Key Differences")
                        comparisonCard(title: "Best Price") { bike in
                            Formatting.currency(bike.bestPrice)
                        }
                        comparisonCard(title: "Weight") { $0.weight }
                        comparisonCard(title: "Travel") { $0.travel }

                        sectionTitle("Ride Setup")
                        comparisonCard(title: "Category") { $0.category }
                        comparisonCard(title: "Wheel") { $0.wheel }
                        comparisonCard(title: "Suspension") { $0.suspension }
                        comparisonCard(title: "Frame") { $0.frame }

                        sectionTitle("Components")
                        comparisonCard(title: "Drivetrain") { $0.drivetrain }
                        comparisonCard(title: "Fork") { $0.fork }
                        comparisonCard(title: "Shock") { $0.shock }

                        sectionTitle("Fit & Buying")
                        comparisonCard(title: "Sizes") { $0.sizes.joined(separator: ", ") }
                        comparisonCard(title: "Retailers") { bike in
                            retailerPriceSummary(for: bike)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .topLeading)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                }
            }
        }
        .background(Color.rBackground.ignoresSafeArea())
        .navigationTitle("Compare")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var bikeHeroRow: some View {
        HStack(spacing: 10) {
            ForEach(compared) { bike in
                VStack(spacing: 0) {
                    ZStack {
                        Color.rCard
                        BikeResolvedImageView(
                            bike: bike,
                            contentMode: .fit,
                            imagePadding: EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8),
                            placeholder: { compareImagePlaceholder }
                        )
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 130)

                    Divider()

                    VStack(alignment: .leading, spacing: 3) {
                        Text(bike.brand.uppercased())
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Text(bike.model)
                            .font(.footnote.weight(.bold))
                            .lineLimit(2)
                            .minimumScaleFactor(0.8)
                        if let price = bike.bestPrice {
                            Text(Formatting.currency(price))
                                .font(.footnote.weight(.heavy))
                                .foregroundStyle(Color.rGreen)
                        } else {
                            Text("See retailer")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
                    .background(Color.rCard)
                }
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .overlay(alignment: .topTrailing) {
                    Button {
                        appState.toggleCompare(bike.id)
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 9, weight: .bold))
                            .padding(6)
                            .background(.ultraThinMaterial)
                            .clipShape(Circle())
                    }
                    .foregroundStyle(.primary)
                    .padding(8)
                }
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.rBorder, lineWidth: 1))
                .shadow(color: Color.black.opacity(0.08), radius: 6, x: 0, y: 3)
            }
        }
    }

    private var compareImagePlaceholder: some View {
        ZStack {
            LinearGradient(
                colors: [Color.rOrangeDark, Color.rOrange],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            Image(systemName: "bicycle")
                .font(.system(size: 30, weight: .semibold))
                .foregroundStyle(.white.opacity(0.9))
        }
    }

    @ViewBuilder
    private func comparisonCard(title: String, value: @escaping (Bike) -> String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.caption.weight(.bold))
                .foregroundStyle(Color.rOrange)

            HStack(alignment: .top, spacing: 10) {
                ForEach(compared) { bike in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(shortLabel(for: bike))
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                        Text(value(bike))
                            .font(.subheadline.weight(.semibold))
                            .lineLimit(3)
                            .minimumScaleFactor(0.8)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(10)
                    .background(Color.rOrangeLight.opacity(0.45))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
            }
        }
        .padding(12)
        .background(Color.rCard)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.rBorder, lineWidth: 1)
        )
    }

    private func shortLabel(for bike: Bike) -> String {
        let m = bike.model
        return m.count > 14 ? String(m.prefix(13)) + "…" : m
    }

    private func sectionTitle(_ text: String) -> some View {
        Text(text)
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(.secondary)
    }

    private func retailerPriceSummary(for bike: Bike) -> String {
        bike.prices
            .compactMap { key, price in
                guard let retailer = RETAILERS.first(where: { $0.id == key }) else { return nil }
                return "\(retailer.name): \(Formatting.currency(price))"
            }
            .sorted()
            .joined(separator: "  ·  ")
    }
}
