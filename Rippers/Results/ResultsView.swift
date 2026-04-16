import SwiftUI

struct ResultsView: View {
    @EnvironmentObject private var filterStore: FilterStore
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var catalogStore: CatalogStore
    @State private var selectedBike: Bike?
    @State private var showAIChat = false
    @State private var randomQuote: String = ""
    private var displayRows: [(bike: Bike, score: Int?, reasons: [String], factors: [MatchFactor])] {
        if filterStore.state.tailorToProfile {
            let ranked = filterStore.rankedBikes
            let sort = filterStore.state.sort
            let ordered: [(bike: Bike, score: Int)]
            if sort == .bestMatch {
                ordered = ranked
            } else {
                ordered = ranked.sorted { BikeFilterEngine.sortComparator(for: sort)($0.bike, $1.bike) }
            }
            return ordered.map { row in
                (
                    row.bike,
                    Optional(row.score),
                    BikeFilterEngine.explainScore(for: row.bike, filters: filterStore.state),
                    BikeFilterEngine.scoreBreakdown(for: row.bike, filters: filterStore.state)
                )
            }
        }
        let sorted = filterStore.filteredBikes.sorted(by: BikeFilterEngine.sortComparator(for: filterStore.state.sort))
        return sorted.map { ($0, nil, [], []) }
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
                                        .foregroundStyle(Color.rChipForeground)
                                    Button("✕") { filterStore.removeToken(token) }
                                        .font(.caption2)
                                        .foregroundStyle(Color.rChipForeground)
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
                    if !randomQuote.isEmpty {
                        Text("\"\(randomQuote)\"")
                            .font(.caption.italic())
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 24)
                            .padding(.top, 8)
                            .padding(.bottom, 2)
                    }
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
            .onAppear {
                if randomQuote.isEmpty {
                    randomQuote = MTB_QUOTES.randomElement() ?? ""
                }
            }
            .navigationTitle("Results (\(displayRows.count))")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                Menu {
                    ForEach(BikeSortOption.allCases, id: \.self) { option in
                        if option == .bestMatch && !filterStore.state.tailorToProfile { EmptyView() } else {
                            Button {
                                filterStore.state.sort = option
                            } label: {
                                if filterStore.state.sort == option {
                                    Label(option.label, systemImage: "checkmark")
                                } else {
                                    Text(option.label)
                                }
                            }
                        }
                    }
                } label: {
                    Label("Sort", systemImage: "arrow.up.arrow.down")
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
            .overlay {
                if filterStore.isLiveSearching {
                    ZStack {
                        Color.black.opacity(0.3).ignoresSafeArea()
                        VStack(spacing: 14) {
                            ProgressView()
                                .tint(.white)
                                .scaleEffect(1.4)
                            Text("Searching the web for bikes...")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.white)
                            Text("Checking AU retailers · Powered by AI")
                                .font(.caption)
                                .foregroundStyle(.white.opacity(0.75))
                        }
                        .padding(24)
                        .background(.ultraThinMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                    }
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
        VStack(alignment: .leading, spacing: 6) {
            // Live search result banner (shown when live results are loaded)
            if let liveSource = filterStore.liveResultSource {
                HStack(spacing: 8) {
                    Circle()
                        .fill(Color.rGreen)
                        .frame(width: 8, height: 8)
                    Image(systemName: "wifi")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(Color.rGreen)
                    Text(liveSource)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color.rGreen)
                    Spacer()
                    Button("Clear") {
                        filterStore.clearLiveResults()
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.rGreen.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 10))
            } else if let error = filterStore.liveSearchError {
                HStack(spacing: 8) {
                    Circle()
                        .fill(Color.red)
                        .frame(width: 8, height: 8)
                    Text("Live search unavailable · \(error)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.rCard)
                .clipShape(RoundedRectangle(cornerRadius: 10))
            } else {
                // Static/cached catalog banner
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
