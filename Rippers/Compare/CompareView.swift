import SwiftUI

struct CompareView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var filterStore: FilterStore

    private var compared: [Bike] {
        filterStore.catalog.filter { appState.compareSet.contains($0.id) }
    }

    var body: some View {
        NavigationStack {
            if compared.isEmpty {
                ContentUnavailableView(
                    "No Bikes Selected",
                    systemImage: "arrow.left.arrow.right",
                    description: Text("Select up to 3 bikes in Results to compare.")
                )
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
                ZStack(alignment: .bottomLeading) {
                    compareBikeImage(bike)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)

                    LinearGradient(
                        colors: [.clear, Color.black.opacity(0.7)],
                        startPoint: .top,
                        endPoint: .bottom
                    )

                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(bike.brand.uppercased())
                                .font(.caption2.weight(.bold))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color.rCard.opacity(0.2))
                                .clipShape(Capsule())
                            Spacer()
                            Button {
                                appState.toggleCompare(bike.id)
                            } label: {
                                Image(systemName: "xmark")
                                    .font(.caption.weight(.bold))
                                    .padding(8)
                                    .background(Color.black.opacity(0.35))
                                    .clipShape(Circle())
                            }
                            .foregroundStyle(.white)
                        }

                        Spacer()

                        Text(bike.model)
                            .font(.title3.weight(.bold))
                            .foregroundStyle(.white)
                            .lineLimit(2)
                        HStack(alignment: .lastTextBaseline) {
                            Text(Formatting.currency(bike.bestPrice))
                                .font(.title2.weight(.heavy))
                                .foregroundStyle(Color.rOrangeLight)
                            Text("Best price")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.white.opacity(0.75))
                        }
                    }
                    .padding(12)
                }
                .frame(maxWidth: .infinity, minHeight: 220, maxHeight: 220)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.white.opacity(0.35), lineWidth: 1)
                )
                .shadow(color: Color.black.opacity(0.12), radius: 8, x: 0, y: 4)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    @ViewBuilder
    private func compareBikeImage(_ bike: Bike) -> some View {
        if let urlString = BIKE_IMAGES[bike.id], let url = URL(string: urlString) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .empty:
                    ZStack {
                        compareImagePlaceholder
                        ProgressView()
                            .tint(.white)
                    }
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFill()
                case .failure:
                    compareImagePlaceholder
                @unknown default:
                    compareImagePlaceholder
                }
            }
        } else {
            compareImagePlaceholder
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
                        Text(bike.brand)
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
