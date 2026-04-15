import SwiftUI

struct ResultsView: View {
    @EnvironmentObject private var filterStore: FilterStore
    @EnvironmentObject private var appState: AppState
    @State private var selectedBike: Bike?
    private var displayRows: [(bike: Bike, score: Int?, reasons: [String], factors: [MatchFactor])] {
        if filterStore.state.tailorToProfile {
            return filterStore.rankedBikes.map { row in
                (
                    row.bike,
                    Optional(row.score),
                    BikeFilterEngine.explainScore(for: row.bike, filters: filterStore.state),
                    BikeFilterEngine.scoreBreakdown(for: row.bike, filters: filterStore.state)
                )
            }
        }
        return filterStore.filteredBikes.map { ($0, nil, [], []) }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                if !filterStore.activeFilterTokens.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack {
                            ForEach(filterStore.activeFilterTokens) { token in
                                HStack(spacing: 4) {
                                    Text(token.label).font(.caption)
                                    Button("✕") { filterStore.removeToken(token) }
                                        .font(.caption2)
                                }
                                .padding(.horizontal, 9)
                                .padding(.vertical, 6)
                                .background(Color.rOrangeLight)
                                .clipShape(Capsule())
                            }
                        }
                        .padding(.horizontal)
                    }
                    .padding(.top, 10)
                }

                if displayRows.isEmpty {
                    ContentUnavailableView(
                        "No Bikes Match",
                        systemImage: "magnifyingglass",
                        description: Text("Try clearing filters or expanding budget/category.")
                    )
                    .padding(.top, 80)
                } else {
                    LazyVStack(spacing: 12) {
                        ForEach(displayRows, id: \.bike.id) { row in
                            BikeCardView(bike: row.bike, matchScore: row.score, matchReasons: row.reasons, matchFactors: row.factors) {
                                selectedBike = row.bike
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .topLeading)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                }
            }
            .background(Color.rBackground.ignoresSafeArea())
            .rippersBrandedTitle("Results (\(displayRows.count))")
            .toolbar {
                Menu("Sort") {
                    ForEach(BikeSortOption.allCases, id: \.self) { option in
                        Button(option.rawValue) {
                            filterStore.state.sort = option
                        }
                    }
                }
            }
            .overlay(alignment: .bottom) {
                if !appState.compareSet.isEmpty {
                    HStack {
                        Text("Compare: \(appState.compareSet.count)")
                        Spacer()
                        Button("Go") { appState.activeTab = .compare }
                        Button("Clear") { appState.compareSet.removeAll() }
                    }
                    .padding()
                    .background(.thinMaterial)
                }
            }
            .fullScreenCover(item: $selectedBike) { bike in
                BikeDetailView(bike: bike)
            }
        }
    }
}
