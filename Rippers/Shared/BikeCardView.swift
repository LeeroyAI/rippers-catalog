import SwiftUI
import SwiftData

struct BikeCardView: View {
    let bike: Bike
    var matchScore: Int? = nil
    var matchReasons: [String] = []
    var matchFactors: [MatchFactor] = []
    var onOpenDetail: (() -> Void)? = nil
    @State private var showScoringSheet = false

    @EnvironmentObject private var appState: AppState
    @Environment(\.modelContext) private var modelContext
    @Query private var watchlistItems: [WatchlistItem]

    var isInCompare: Bool { appState.compareSet.contains(bike.id) }
    var watchlistItem: WatchlistItem? { watchlistItems.first(where: { $0.bikeId == bike.id }) }
    var isWatched: Bool { watchlistItem != nil }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            bikeImageView
                .frame(height: 190)
                .frame(maxWidth: .infinity)
                .background(Color.rCard)
                .clipShape(RoundedRectangle(cornerRadius: 12))

            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(bike.brand)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text("\(bike.model) · \(String(bike.year))")
                        .font(.headline)
                }
                Spacer()
                if let matchScore {
                    Text("Match \(matchScore)%")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(Color.rBadgeForeground)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.rBlueBg)
                        .clipShape(Capsule())
                }
                Button {
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                    toggleWatch()
                } label: {
                    Image(systemName: isWatched ? "bell.fill" : "bell")
                        .foregroundStyle(isWatched ? Color.rOrange : .secondary)
                }
                .accessibilityLabel(isWatched ? "Remove from watchlist" : "Add to watchlist")
            }

            Text("\(bike.category) · \(bike.wheel) · \(bike.travel)")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            if let savings = bike.savings, savings > 0 {
                Text("Save \(Formatting.currency(savings))")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.rGreen)
            }

            if !matchReasons.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("Why this bike")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(.secondary)
                        Spacer()
                        if !matchFactors.isEmpty {
                            Button("Details") { showScoringSheet = true }
                                .font(.caption2.weight(.semibold))
                        }
                    }
                    ForEach(matchReasons, id: \.self) { reason in
                        Text("• \(reason)")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(8)
                .background(Color.rOrangeLight.opacity(0.5))
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }

            Text("Best: \(Formatting.currency(bike.bestPrice))")
                .font(.title3.weight(.semibold))
                .foregroundStyle(Color.rGreen)

            VStack(spacing: 6) {
                ForEach(sortedRetailerPrices, id: \.retailer.id) { row in
                    HStack {
                        Text(row.retailer.name)
                            .font(.caption)
                        if !row.retailer.isAustralian {
                            Text("INTL")
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(Color.rBadgeForeground)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.rBlueBg)
                                .clipShape(Capsule())
                        }
                        Spacer()
                        Text(Formatting.currency(row.price))
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(row.price == bike.bestPrice ? Color.rGreen : Color.primary)
                    }
                }
            }

            Text("Sizes: \(bike.sizes.joined(separator: ", "))")
                .font(.caption)
                .foregroundStyle(.secondary)

            HStack {
                let atCapacity = !isInCompare && appState.compareSet.count >= 3
                Button(isInCompare ? "Remove Compare" : atCapacity ? "Compare Full (3/3)" : "+ Compare") {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    appState.toggleCompare(bike.id)
                }
                .buttonStyle(.bordered)
                .disabled(atCapacity)

                Spacer()

                if let bestRow = sortedRetailerPrices.first,
                   let directURL = bestRow.retailer.directURL(for: bike) {
                    Link(destination: directURL) {
                        HStack(spacing: 4) {
                            Text("Best Deal")
                            Image(systemName: "arrow.up.right")
                                .font(.caption.weight(.bold))
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Color.rOrange)
                }
            }
        }
        .padding()
        .background(Color.rCard)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.rBorder, lineWidth: 1)
        )
        .contentShape(Rectangle())
        .onTapGesture {
            onOpenDetail?()
        }
        .sheet(isPresented: $showScoringSheet) {
            NavigationStack {
                List {
                    if let matchScore {
                        Section("Overall Match") {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("\(matchScore)%")
                                    .font(.largeTitle.weight(.bold))
                                    .foregroundStyle(Color.rOrange)
                                Text(confidenceLabel(for: matchScore))
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(confidenceColor(for: matchScore))
                            }
                        }
                    }
                    if !positiveFactors.isEmpty {
                        Section("Positive Factors") {
                            ForEach(positiveFactors) { factor in
                                factorRow(factor, tone: Color.rGreen)
                            }
                        }
                    }
                    if !neutralFactors.isEmpty {
                        Section("Neutral Factors") {
                            ForEach(neutralFactors) { factor in
                                factorRow(factor, tone: Color.rTextMuted)
                            }
                        }
                    }
                    if !negativeFactors.isEmpty {
                        Section("Negative Factors") {
                            ForEach(negativeFactors) { factor in
                                factorRow(factor, tone: Color.rRed)
                            }
                        }
                    }
                }
                .navigationTitle("Score Details")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Done") { showScoringSheet = false }
                    }
                }
            }
        }
    }

    private var positiveFactors: [MatchFactor] { matchFactors.filter { $0.points > 0 } }
    private var neutralFactors: [MatchFactor] { matchFactors.filter { $0.points == 0 } }
    private var negativeFactors: [MatchFactor] { matchFactors.filter { $0.points < 0 } }

    @ViewBuilder
    private func factorRow(_ factor: MatchFactor, tone: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text(factor.title)
                Spacer()
                Text(factor.points >= 0 ? "+\(factor.points)" : "\(factor.points)")
                    .foregroundStyle(tone)
                    .font(.caption.weight(.bold))
            }
            Text(factor.note)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private func confidenceLabel(for score: Int) -> String {
        switch score {
        case 85...100: return "High confidence fit"
        case 65..<85: return "Good confidence fit"
        case 45..<65: return "Moderate confidence fit"
        default: return "Low confidence fit"
        }
    }

    private func confidenceColor(for score: Int) -> Color {
        switch score {
        case 85...100: return Color.rGreen
        case 65..<85: return Color.rBlue
        case 45..<65: return Color.rYellow
        default: return Color.rRed
        }
    }

    @ViewBuilder
    private var bikeImageView: some View {
        BikeResolvedImageView(
            bike: bike,
            contentMode: .fit,
            imagePadding: EdgeInsets(top: 6, leading: 8, bottom: 6, trailing: 8),
            placeholder: { placeholderImage }
        )
    }

    private var placeholderImage: some View {
        ZStack {
            LinearGradient(colors: [Color.rOrangeLight, Color.rCard], startPoint: .topLeading, endPoint: .bottomTrailing)
            Image(systemName: "bicycle")
                .font(.system(size: 36, weight: .semibold))
                .foregroundStyle(Color.rOrange)
        }
    }

    private var sortedRetailerPrices: [(retailer: Retailer, price: Double)] {
        bike.prices
            .compactMap { key, value in
                guard let retailer = RETAILERS.first(where: { $0.id == key }) else { return nil }
                return (retailer, value)
            }
            .sorted(by: { $0.price < $1.price })
            .prefix(3)
            .map { $0 }
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
}

struct BikeResolvedImageView<Placeholder: View>: View {
    let bike: Bike
    let contentMode: ContentMode
    let imagePadding: EdgeInsets
    let placeholder: () -> Placeholder

    @State private var resolvedURL: URL?
    @State private var isResolving = false

    var body: some View {
        ZStack {
            if let resolvedURL {
                AsyncImage(url: resolvedURL) { phase in
                    switch phase {
                    case .empty:
                        progressPlaceholder
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: contentMode)
                            .padding(imagePadding)
                    case .failure:
                        placeholder()
                    @unknown default:
                        placeholder()
                    }
                }
            } else {
                progressPlaceholder
            }
        }
        .task(id: bike.imageCacheKey) {
            await resolve()
        }
    }

    @ViewBuilder
    private var progressPlaceholder: some View {
        if isResolving {
            ZStack {
                placeholder()
                ProgressView().tint(Color.rOrange)
            }
        } else {
            placeholder()
        }
    }

    private func resolve() async {
        isResolving = true
        defer { isResolving = false }
        resolvedURL = await BikeImageResolver.shared.resolvedImageURL(for: bike)
    }
}
