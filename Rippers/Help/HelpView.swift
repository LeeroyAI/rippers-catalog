import SwiftUI

struct HelpView: View {
    @State private var expandedFAQ: String? = nil
    @State private var chatInput = ""
    @State private var chatMessages: [HelpChatMessage] = []
    @State private var isChatLoading = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    heroCard
                    howItWorksCard
                    featuresGrid
                    faqCard
                    aiChatCard
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
            }
            .background(Color.rBackground.ignoresSafeArea())
            .navigationTitle("Help")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                if chatMessages.isEmpty {
                    chatMessages.append(.assistant("Ask me anything about Rippers — searching, profiles, budgets, sizing, trip planning, and more."))
                }
            }
        }
    }

    // ---------------------------------------------------------------------------
    // MARK: Hero
    // ---------------------------------------------------------------------------

    private var heroCard: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 6) {
                Text("How can we help?")
                    .font(.title3.weight(.bold))
                Text("Rippers finds your perfect MTB — matching real bikes to your body, budget, and riding style.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "bicycle")
                .font(.system(size: 36, weight: .semibold))
                .foregroundStyle(Color.rOrange)
        }
        .padding(14)
        .background(LinearGradient(colors: [Color.rCard, Color.rOrangeLight], startPoint: .topLeading, endPoint: .bottomTrailing))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.rBorder, lineWidth: 1))
    }

    // ---------------------------------------------------------------------------
    // MARK: How it works
    // ---------------------------------------------------------------------------

    private var howItWorksCard: some View {
        sectionCard("HOW IT WORKS") {
            VStack(spacing: 10) {
                stepRow("1", icon: "person.fill", title: "Build your rider profile", body: "Add height, weight, experience, riding style, and budget. Rippers uses this to rank every bike for you personally.")
                stepRow("2", icon: "wifi", title: "Search bikes live", body: "Tap 'Search Bikes Live' to fetch real-time stock and prices from AU retailers via Brave Search and Claude AI.")
                stepRow("3", icon: "arrow.left.arrow.right", title: "Compare and decide", body: "Select up to 3 bikes from results and compare specs, prices, and sizing side-by-side.")
                stepRow("4", icon: "map.fill", title: "Plan your trip", body: "Find trails, local shops, and gear lists for any destination — with directions built in.")
            }
        }
    }

    private func stepRow(_ number: String, icon: String, title: String, body: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                Circle().fill(Color.rOrange)
                    .frame(width: 28, height: 28)
                Image(systemName: icon)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.subheadline.weight(.semibold))
                Text(body).font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    // ---------------------------------------------------------------------------
    // MARK: Feature grid
    // ---------------------------------------------------------------------------

    private var featuresGrid: some View {
        sectionCard("FEATURES") {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                featureTile("Home", icon: "house.fill", body: "Profile-driven top picks, live search, and quick access to your catalog.")
                featureTile("Results", icon: "list.bullet", body: "Ranked, filterable bike list. Sort by price, match, or travel.")
                featureTile("Compare", icon: "arrow.left.arrow.right", body: "Side-by-side spec and price comparison for up to 3 bikes.")
                featureTile("Sizing", icon: "ruler", body: "Frame size recommendation by height + style. See which bikes actually stock your size.")
                featureTile("Budget", icon: "dollarsign.circle", body: "Full cost breakdown — bike, gear, and hidden costs — vs your profile budget.")
                featureTile("Trip Planner", icon: "map.fill", body: "Find trails, bike shops, and terrain-suited bikes near any destination.")
                featureTile("Watchlist", icon: "bell.fill", body: "Save bikes and set price alerts. Get notified when prices drop.")
                featureTile("Live Search", icon: "wifi", body: "Brave + Claude AI pipeline fetches fresh stock, specs, and pricing from the web.")
            }
        }
    }

    private func featureTile(_ title: String, icon: String, body: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.rOrange)
                Text(title)
                    .font(.caption.weight(.bold))
            }
            Text(body)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.rBackground.opacity(0.6))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    // ---------------------------------------------------------------------------
    // MARK: FAQ
    // ---------------------------------------------------------------------------

    private var faqCard: some View {
        sectionCard("FAQ") {
            VStack(spacing: 0) {
                ForEach(faqs, id: \.question) { faq in
                    VStack(spacing: 0) {
                        Button {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                expandedFAQ = expandedFAQ == faq.question ? nil : faq.question
                            }
                        } label: {
                            HStack {
                                Text(faq.question)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(.primary)
                                    .multilineTextAlignment(.leading)
                                Spacer()
                                Image(systemName: expandedFAQ == faq.question ? "chevron.up" : "chevron.down")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.secondary)
                            }
                            .padding(.vertical, 12)
                        }
                        .buttonStyle(.plain)

                        if expandedFAQ == faq.question {
                            Text(faq.answer)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.bottom, 12)
                                .transition(.opacity.combined(with: .move(edge: .top)))
                        }

                        Divider()
                    }
                }
            }
        }
    }

    private let faqs: [(question: String, answer: String)] = [
        (
            "How does Live Search work?",
            "Tapping 'Search Bikes Live' sends your filters to a Vercel serverless function. It runs 3–4 targeted searches via the Brave Search API, then passes the results to Claude AI to extract bike specs, prices, and stock. Images are fetched from brand websites. The whole pipeline takes 20–40 seconds."
        ),
        (
            "Why does my profile show 0 matches?",
            "Your profile budget cap or category filter may be too strict for the current catalog. Try broadening the budget in your profile, or set category to 'Any'. Live search will still find matches from the web even when the local catalog is empty."
        ),
        (
            "What's the difference between the catalog and live search?",
            "The catalog is a curated list of ~48 bikes loaded from a GitHub-hosted JSON file and refreshed hourly. Live search fetches fresh results directly from AU retailer websites in real time — it finds bikes not in the catalog."
        ),
        (
            "How do I compare bikes?",
            "Tap the compare icon on any bike card in Results to add it to your compare set (up to 3). When you have bikes selected, a banner appears at the bottom — tap 'Go' to open the Compare tab."
        ),
        (
            "How does sizing work?",
            "The Sizing tab uses your profile height and riding style to recommend a frame size (XS–XXL) and wheel size. It also scans the catalog to show how many bikes are stocked in your size."
        ),
        (
            "Can I save a search and reuse it?",
            "Yes — on the Home tab when no profile is active, tap 'Save Search' after setting your filters. Saved searches appear as quick-tap chips above the filter form."
        ),
        (
            "What is the Watchlist for?",
            "Add bikes you're interested in to your Watchlist. Set a target price and Rippers will alert you (via a badge on the tab) when the bike price drops to your target."
        ),
        (
            "How do Trip Planner directions work?",
            "After searching a destination, bike shops appear below the map. Tap 'Directions' on any shop to open Apple Maps with turn-by-turn navigation from your current GPS location."
        )
    ]

    // ---------------------------------------------------------------------------
    // MARK: AI Chat
    // ---------------------------------------------------------------------------

    private var aiChatCard: some View {
        sectionCard("ASK AI") {
            VStack(spacing: 10) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(chatMessages) { msg in
                            HStack {
                                if msg.role == .assistant {
                                    Text(msg.text)
                                        .font(.caption)
                                        .padding(10)
                                        .background(Color.rOrangeLight)
                                        .clipShape(RoundedRectangle(cornerRadius: 10))
                                    Spacer(minLength: 40)
                                } else {
                                    Spacer(minLength: 40)
                                    Text(msg.text)
                                        .font(.caption)
                                        .padding(10)
                                        .background(Color.rBackground)
                                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.rBorder, lineWidth: 1))
                                        .clipShape(RoundedRectangle(cornerRadius: 10))
                                }
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(maxHeight: 200)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        quickQuestion("How does live search work?")
                        quickQuestion("How do I size a bike?")
                        quickQuestion("What is the watchlist?")
                        quickQuestion("How do I compare bikes?")
                    }
                }

                HStack(spacing: 8) {
                    TextField("Ask about any feature...", text: $chatInput)
                        .textFieldStyle(.roundedBorder)
                        .font(.caption)
                        .disabled(isChatLoading)
                    if isChatLoading {
                        ProgressView().tint(Color.rOrange)
                    } else {
                        Button("Send") { Task { await sendChat() } }
                            .buttonStyle(.borderedProminent)
                            .tint(Color.rOrange)
                            .disabled(chatInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
            }
        }
    }

    private func quickQuestion(_ q: String) -> some View {
        Button(q) {
            chatInput = q
            Task { await sendChat() }
        }
        .buttonStyle(.bordered)
        .font(.caption)
        .disabled(isChatLoading)
    }

    private func sendChat() async {
        let q = chatInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty, !isChatLoading else { return }
        chatMessages.append(.user(q))
        chatInput = ""
        isChatLoading = true
        defer { isChatLoading = false }

        let apiMessages = chatMessages.map {
            AIChatMessage(role: $0.role == .user ? "user" : "assistant", content: $0.text)
        }
        do {
            let reply = try await AIChatService.shared.send(messages: apiMessages)
            chatMessages.append(.assistant(reply))
        } catch {
            chatMessages.append(.assistant(helpReply(for: q)))
        }
    }

    private func helpReply(for question: String) -> String {
        let q = question.lowercased()

        if q.contains("live search") || q.contains("search work") || q.contains("brave") || q.contains("claude") {
            return "Live Search sends your filters to a Vercel function that runs Brave Search queries then passes snippets to Claude AI. It extracts specs, prices, and stock from retailer pages. Expect 20–40 seconds — the progress overlay shows each stage."
        }
        if q.contains("siz") || q.contains("frame") || q.contains("height") {
            return "The Sizing tab recommends XS–XXL frame size and wheel size based on your profile height and riding style. It also shows how many catalog bikes stock your size — tap any bike to see full details."
        }
        if q.contains("compare") {
            return "Tap the compare icon on bike cards in Results to select up to 3 bikes. When bikes are selected, a banner appears at the bottom — tap 'Go' to see a side-by-side spec and price comparison."
        }
        if q.contains("watchlist") || q.contains("alert") || q.contains("price drop") {
            return "The Watchlist lets you save bikes you're interested in. Set a target price and you'll see a badge on the Watchlist tab when the bike price drops to or below your target."
        }
        if q.contains("budget") || q.contains("cost") || q.contains("gear") {
            return "The Budget tab calculates your full ride cost: chosen bike + required safety gear (helmet, pads, shoes) + optional extras + hidden costs like first service and tubeless setup. Switch between Budget / Mid / Premium gear tiers."
        }
        if q.contains("trip") || q.contains("shop") || q.contains("trail") || q.contains("direction") {
            return "Trip Planner searches for mountain bike trails and bike shops near any destination. Shops show phone, website, and a Directions button that opens Apple Maps navigation from your current location."
        }
        if q.contains("profile") || q.contains("create") || q.contains("setup") {
            return "Create a profile on the Home tab with your height, weight, riding style, and budget. Your profile drives bike rankings, sizing, budget defaults, and trip recommendations. You can have multiple profiles and switch between them."
        }
        if q.contains("catalog") || q.contains("how many bikes") {
            return "The catalog is ~48 curated AU bikes loaded from a GitHub JSON file, refreshed hourly. Live search goes beyond the catalog, fetching real-time stock from retailer websites. The green/orange dot on the Home banner shows catalog freshness."
        }
        if q.contains("save search") || q.contains("saved search") {
            return "On the Home tab (no profile active), set your filters and tap 'Save Search'. Your saved searches appear as quick-tap chips at the top of the filter section for one-tap reuse."
        }
        return "I can answer questions about searching, profiles, sizing, budget planning, comparing bikes, the watchlist, trip planner, and live search. What would you like to know?"
    }

    // ---------------------------------------------------------------------------
    // MARK: Helpers
    // ---------------------------------------------------------------------------

    private func sectionCard<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.caption.weight(.bold))
                .foregroundStyle(Color.rOrange)
            content()
        }
        .padding(12)
        .background(Color.rCard)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}

private struct HelpChatMessage: Identifiable {
    enum Role { case user, assistant }
    let id = UUID()
    let role: Role
    let text: String
    static func user(_ t: String) -> HelpChatMessage { .init(role: .user, text: t) }
    static func assistant(_ t: String) -> HelpChatMessage { .init(role: .assistant, text: t) }
}
