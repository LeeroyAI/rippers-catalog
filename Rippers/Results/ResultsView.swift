import SwiftUI

struct ResultsView: View {
    @EnvironmentObject private var filterStore: FilterStore
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var catalogStore: CatalogStore
    @State private var selectedBike: Bike?
    @State private var showAIChat = false
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
                catalogStatusBanner
                    .padding(.horizontal, 12)
                    .padding(.top, 8)
                if !filterStore.activeFilterTokens.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack {
                            ForEach(filterStore.activeFilterTokens) { token in
                                HStack(spacing: 4) {
                                    Text(token.label)
                                        .font(.caption)
                                        .foregroundStyle(Color.dynamic(light: Color.rOrangeDark, dark: .white))
                                    Button("✕") { filterStore.removeToken(token) }
                                        .font(.caption2)
                                        .foregroundStyle(Color.dynamic(light: Color.rOrangeDark, dark: .white))
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
            .navigationTitle("Results (\(displayRows.count))")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                Menu("Sort") {
                    ForEach(BikeSortOption.allCases, id: \.self) { option in
                        Button(option.rawValue) {
                            filterStore.state.sort = option
                        }
                    }
                }
                Button("Ask AI") {
                    showAIChat = true
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
            .sheet(isPresented: $showAIChat) {
                ResultsAIChatModal(
                    bikes: displayRows.map(\.bike),
                    activeFilterLabels: filterStore.activeFilterTokens.map(\.label)
                )
            }
        }
    }

    private var catalogStatusBanner: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(catalogStore.sourceStatus == "Live source" ? Color.rGreen : Color.rOrange)
                .frame(width: 8, height: 8)
            Text(catalogStore.sourceStatus)
                .font(.caption.weight(.semibold))
            if let fallbackReason = catalogStore.fallbackReason, !fallbackReason.isEmpty {
                Text("· \(fallbackReason)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.rCard)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

private struct ResultsAIChatModal: View {
    let bikes: [Bike]
    let activeFilterLabels: [String]

    @Environment(\.dismiss) private var dismiss
    @State private var input = ""
    @State private var messages: [ChatMessage] = []

    var body: some View {
        NavigationStack {
            VStack(spacing: 10) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(messages) { msg in
                            HStack {
                                if msg.role == .assistant {
                                    Text(msg.text)
                                        .padding(10)
                                        .background(Color.rOrangeLight)
                                        .clipShape(RoundedRectangle(cornerRadius: 10))
                                    Spacer(minLength: 30)
                                } else {
                                    Spacer(minLength: 30)
                                    Text(msg.text)
                                        .padding(10)
                                        .background(Color.rCard)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 10)
                                                .stroke(Color.rBorder, lineWidth: 1)
                                        )
                                        .clipShape(RoundedRectangle(cornerRadius: 10))
                                }
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 12)
                    .padding(.top, 8)
                }

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack {
                        quickAsk("What is the best value bike?")
                        quickAsk("Which bike matches my filters best?")
                        quickAsk("Show me budget-friendly options")
                        quickAsk("What should I compare first?")
                    }
                    .padding(.horizontal, 12)
                }

                HStack(spacing: 8) {
                    TextField("Ask about bikes, budget, filters...", text: $input)
                        .textFieldStyle(.roundedBorder)
                    Button("Send") { sendInput() }
                        .buttonStyle(.borderedProminent)
                        .tint(Color.rOrange)
                        .disabled(input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                .padding(.horizontal, 12)
                .padding(.bottom, 10)
            }
            .background(Color.rBackground.ignoresSafeArea())
            .navigationTitle("AI Ride Assistant")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .onAppear {
                if messages.isEmpty {
                    messages.append(.assistant("I can help with your current results. Ask about best value, fit, budget, or what to compare."))
                }
            }
        }
    }

    private func quickAsk(_ prompt: String) -> some View {
        Button(prompt) {
            input = prompt
            sendInput()
        }
        .buttonStyle(.bordered)
    }

    private func sendInput() {
        let question = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !question.isEmpty else { return }
        messages.append(.user(question))
        input = ""
        messages.append(.assistant(reply(for: question)))
    }

    private func reply(for question: String) -> String {
        let q = question.lowercased()
        guard !bikes.isEmpty else {
            return "I do not see any bikes in results yet. Try broadening filters or budget, then search again."
        }

        let sortedByPrice = bikes.sorted { ($0.bestPrice ?? .greatestFiniteMagnitude) < ($1.bestPrice ?? .greatestFiniteMagnitude) }
        let cheapest = sortedByPrice.first
        let topThree = sortedByPrice.prefix(3).map { "\($0.brand) \($0.model) (\(Formatting.currency($0.bestPrice)))" }
        let filtersText = activeFilterLabels.isEmpty ? "No active filters." : "Active filters: \(activeFilterLabels.joined(separator: ", "))."

        if q.contains("best value") || q.contains("cheapest") || q.contains("budget") {
            if let cheapest {
                return "Best value from current results is \(cheapest.brand) \(cheapest.model) at \(Formatting.currency(cheapest.bestPrice)). \(filtersText)"
            }
        }

        if q.contains("match") || q.contains("fit") || q.contains("filters") {
            return "Best matches are already ranked by your current filters. Top options: \(topThree.joined(separator: " • ")). \(filtersText)"
        }

        if q.contains("compare") {
            return "Start comparison with 3 bikes across different price points: \(topThree.joined(separator: " | ")). Focus on category, travel, suspension, and best in-stock retailer price."
        }

        if q.contains("trip") || q.contains("location") || q.contains("shop") {
            return "For location-specific buying, open Trip Planner and search your destination. It now filters riding areas and shops by country + distance, then suggests terrain-suitable bikes."
        }

        return "From your current results, I recommend reviewing these first: \(topThree.joined(separator: " • ")). Ask me for budget picks, compare guidance, or filter refinement."
    }
}

private struct ChatMessage: Identifiable {
    enum Role {
        case user
        case assistant
    }

    let id = UUID()
    let role: Role
    let text: String

    static func user(_ text: String) -> ChatMessage { .init(role: .user, text: text) }
    static func assistant(_ text: String) -> ChatMessage { .init(role: .assistant, text: text) }
}
