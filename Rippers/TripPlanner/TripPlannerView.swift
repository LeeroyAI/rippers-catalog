import SwiftUI
import MapKit
import SwiftData
import CoreLocation

struct TripPlannerView: View {
    @EnvironmentObject private var filterStore: FilterStore
    @EnvironmentObject private var appState: AppState
    @Environment(\.openURL) private var openURL
    @Query private var profiles: [RiderProfile]
    @StateObject private var searchCompleter = LocationSearchCompleter()
    @State private var destination = ""
    @State private var position: MapCameraPosition = .region(
        MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: -33.8688, longitude: 151.2093),
            span: MKCoordinateSpan(latitudeDelta: 0.35, longitudeDelta: 0.35)
        )
    )
    @State private var searchStatus = "Find a riding destination to get profile-matched bike recommendations."
    @State private var regionHint: String = "Trail"
    @State private var nearbyRidingAreas: [MKMapItem] = []
    @State private var trailforksTrails: [TrailforksTrail] = []
    @State private var trailforksStatus: String?
    @State private var nearbyShops: [MKMapItem] = []
    @State private var rentalShopKeys: Set<String> = []
    @State private var lastSearchedDestination: MKMapItem?
    @State private var isSearchingDestination: Bool = false
    @State private var destinationPlacemark: MKPlacemark?
    @AppStorage("rippers.tripPlannerRecentSearches") private var recentSearchesData: String = "[]"
    @State private var selectedTripBike: Bike?
    @AppStorage("rippers.ownedGearIds") private var ownedGearIdsData: String = "[]"
    @Query private var watchlistItems: [WatchlistItem]

    var activeProfile: RiderProfile? { profiles.first(where: { $0.isActive }) }
    private var activeProfileSummary: String {
        guard let profile = activeProfile else { return "No active profile" }
        let inferredCat = RiderProfile.inferredCategory(for: profile.style)
        let category = inferredCat == "Any" ? "Any category" : inferredCat
        let budget = profile.budgetCap > 0 ? "Budget \(Formatting.currency(profile.budgetCap))" : "No budget cap"
        return "\(profile.name) · \(profile.style) · \(category) · \(budget)"
    }
    private var recentSearches: [String] {
        guard let data = recentSearchesData.data(using: .utf8),
              let decoded = try? JSONDecoder().decode([String].self, from: data) else {
            return []
        }
        return decoded
    }
    private var showAutocomplete: Bool {
        !destination.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !searchCompleter.completions.isEmpty
    }
    private var ownedGearIds: Set<String> {
        guard let data = ownedGearIdsData.data(using: .utf8),
              let decoded = try? JSONDecoder().decode([String].self, from: data) else { return [] }
        return Set(decoded)
    }
    private var terrainGearItems: [TripGearItem] {
        switch locationRideType {
        case .gravity:
            return [
                TripGearItem(id: "fullface", name: "Full-Face Helmet", icon: "shield.lefthalf.filled", why: "High-speed bike park runs need maximum head protection.", essential: true),
                TripGearItem(id: "bodyarmor", name: "Body Armour", icon: "figure.fall", why: "Gravity terrain demands torso protection on big crashes.", essential: true),
                TripGearItem(id: "knees", name: "Knee / Shin Guards", icon: "figure.walk", why: "Essential on steep, rocky, exposed terrain.", essential: true),
                TripGearItem(id: "elbows", name: "Elbow Pads", icon: "bandage", why: "Required for enduro stages and bike park tracks.", essential: true),
                TripGearItem(id: "gloves", name: "Gloves", icon: "hand.raised.fill", why: "Grip and abrasion protection on every run.", essential: true),
                TripGearItem(id: "hydration", name: "Hydration Pack", icon: "drop.fill", why: "Carry water, layers, and tools on long bike park days.", essential: false),
            ]
        case .crossCountry:
            return [
                TripGearItem(id: "helmet", name: "Helmet", icon: "shield.lefthalf.filled", why: "Non-negotiable on every ride.", essential: true),
                TripGearItem(id: "gloves", name: "Gloves", icon: "hand.raised.fill", why: "Comfort and protection on long XC loops.", essential: true),
                TripGearItem(id: "hydration", name: "Hydration Pack", icon: "drop.fill", why: "XC loops can be long — carry plenty of water.", essential: true),
                TripGearItem(id: "tools", name: "Trail Tool Kit", icon: "wrench.and.screwdriver", why: "Pump, multitool, and tube for remote trails.", essential: true),
                TripGearItem(id: "knees", name: "Knee Pads", icon: "figure.walk", why: "Recommended even on XC terrain.", essential: false),
            ]
        case .jump:
            return [
                TripGearItem(id: "helmet", name: "Helmet", icon: "shield.lefthalf.filled", why: "Crash protection is non-optional on jump lines.", essential: true),
                TripGearItem(id: "knees", name: "Knee Pads", icon: "figure.walk", why: "Hard landings make knee protection worth it.", essential: true),
                TripGearItem(id: "gloves", name: "Gloves", icon: "hand.raised.fill", why: "Saves your palms on bail-outs.", essential: true),
                TripGearItem(id: "elbows", name: "Elbow Pads", icon: "bandage", why: "Jump riding means frequent arm impact.", essential: false),
            ]
        case .trail, .other:
            return [
                TripGearItem(id: "helmet", name: "Helmet", icon: "shield.lefthalf.filled", why: "Mandatory on every trail ride.", essential: true),
                TripGearItem(id: "knees", name: "Knee Pads", icon: "figure.walk", why: "Highly recommended on technical singletrack.", essential: true),
                TripGearItem(id: "gloves", name: "Gloves", icon: "hand.raised.fill", why: "Grip and crash protection.", essential: true),
                TripGearItem(id: "hydration", name: "Hydration Pack", icon: "drop.fill", why: "Trail networks can be remote — stay hydrated.", essential: true),
                TripGearItem(id: "tools", name: "Trail Tool Kit", icon: "wrench.and.screwdriver", why: "Always carry a pump, multitool, and tube.", essential: true),
            ]
        }
    }
    private var allEssentialGearOwned: Bool {
        terrainGearItems.filter(\.essential).allSatisfy { ownedGearIds.contains($0.id) }
    }
    private var watchlistBikes: [Bike] {
        watchlistItems.compactMap { item in filterStore.catalog.first { $0.id == item.bikeId } }
    }
    private var recommendationResult: (bikes: [Bike], usedProfileFallback: Bool) {
        let inStockBikes = filterStore.catalog.filter { !$0.inStock.isEmpty }
        var bikes = inStockBikes
        var usedProfileFallback = false

        // Location suitability first: only bikes that suit terrain around destination.
        switch locationRideType {
        case .gravity:
            bikes = bikes.filter {
                ($0.category == "Enduro" || $0.category == "Downhill" || $0.travelMM >= 160) &&
                $0.suspension != "Hardtail"
            }
        case .crossCountry:
            bikes = bikes.filter {
                $0.category == "XC / Cross-Country" || ($0.suspension == "Hardtail" && $0.travelMM <= 130)
            }
        case .jump:
            bikes = bikes.filter {
                $0.suspension == "Hardtail" && ($0.wheel == "26\"" || $0.wheel == "27.5\"")
            }
        case .trail:
            bikes = bikes.filter {
                $0.category == "Trail" || $0.category == "All-Mountain" || $0.isEbike
            }
        case .other:
            bikes = bikes.filter {
                $0.category == "Trail" || $0.category == "All-Mountain" || $0.category == "XC / Cross-Country" || $0.isEbike
            }
        }

        // Profile suitability second: prefer rider goals and budget,
        // but keep a useful destination-based list if profile constraints are too restrictive.
        if let profile = activeProfile {
            let locationOnlyBikes = bikes
            var profiledBikes = bikes

            let categoryFromStyle = RiderProfile.inferredCategory(for: profile.style)
            if categoryFromStyle != "Any" {
                profiledBikes = profiledBikes.filter { bike in
                    bike.category == categoryFromStyle ||
                    (categoryFromStyle == "Hardtail" && bike.suspension == "Hardtail")
                }
            }
            if profile.budgetCap > 0 {
                profiledBikes = profiledBikes.filter { ($0.bestPrice ?? .greatestFiniteMagnitude) <= profile.budgetCap }
            }
            let style = RidingDisciplineKind.from(profile.style)
            if style == .gravity {
                profiledBikes = profiledBikes.filter {
                    $0.suspension != "Hardtail" &&
                    ($0.category == "Enduro" || $0.category == "Downhill" || $0.travelMM >= 160)
                }
            } else if style == .crossCountry {
                profiledBikes = profiledBikes.filter { $0.category == "XC / Cross-Country" || $0.suspension == "Hardtail" }
            } else if style == .jump {
                profiledBikes = profiledBikes.filter { $0.suspension == "Hardtail" || $0.wheel == "27.5\"" }
            }

            // Keep recommendations populated for the selected area:
            // if strict profile filtering wipes out options, fall back to location-only bikes.
            if profiledBikes.isEmpty, !locationOnlyBikes.isEmpty {
                usedProfileFallback = true
                bikes = locationOnlyBikes
            } else {
                bikes = profiledBikes
            }
        } else if bikes.isEmpty {
            // No profile: prioritize trail-friendly bikes and keep list broad.
            bikes = inStockBikes
        }

        let sorted = bikes
            .map { bike in (bike: bike, score: areaMatchScore(for: bike)) }
            .filter { $0.score > 0 }
            .sorted {
                if $0.score == $1.score {
                    return ($0.bike.bestPrice ?? .greatestFiniteMagnitude) < ($1.bike.bestPrice ?? .greatestFiniteMagnitude)
                }
                return $0.score > $1.score
            }
            .map(\.bike)
        return (sorted, usedProfileFallback)
    }
    private var recommendedBikes: [Bike] { recommendationResult.bikes }
    private var recommendationTrailSignals: [String] {
        let textBlob = nearbyRidingAreas
            .compactMap { area in
                [area.name, area.placemark.title]
                    .compactMap { $0?.lowercased() }
                    .joined(separator: " ")
            }
            .joined(separator: " ")
        var signals: [String] = []
        if textBlob.contains("downhill") || textBlob.contains("bike park") { signals.append("Steep / gravity terrain") }
        if textBlob.contains("enduro") || textBlob.contains("technical") { signals.append("Technical descending") }
        if textBlob.contains("cross country") || textBlob.contains("xc") { signals.append("Pedal-heavy XC loops") }
        if textBlob.contains("jump") || textBlob.contains("pump track") { signals.append("Jumps and pump track features") }
        if textBlob.contains("flow") || textBlob.contains("singletrack") { signals.append("Flowing singletrack") }
        return signals
    }
    private var areaBikeStyles: [AreaBikeStyle] {
        switch locationRideType {
        case .gravity:
            return [
                .init(name: "Enduro"),
                .init(name: "Downhill"),
                .init(name: "eMTB")
            ]
        case .crossCountry:
            return [
                .init(name: "XC / Cross-Country"),
                .init(name: "Trail Hardtail")
            ]
        case .trail:
            return [
                .init(name: "Trail"),
                .init(name: "All-Mountain"),
                .init(name: "eMTB")
            ]
        case .jump:
            return [
                .init(name: "Hardtail"),
                .init(name: "Dirt Jump")
            ]
        case .other:
            return [
                .init(name: "Trail"),
                .init(name: "All-Mountain"),
                .init(name: "eMTB")
            ]
        }
    }

    private var locationRideType: RidingDisciplineKind {
        if !nearbyRidingAreas.isEmpty {
            let blob = nearbyRidingAreas
                .compactMap { [$0.name, $0.placemark.title].compactMap { $0 }.joined(separator: " ") }
                .joined(separator: " ")
                .lowercased()
            if blob.contains("downhill") || blob.contains("bike park") || blob.contains("enduro") || blob.contains("gravity") {
                return .gravity
            }
            if blob.contains("cross country") || blob.contains("xc") || blob.contains("singletrack loop") {
                return .crossCountry
            }
            if blob.contains("jump") || blob.contains("pump track") {
                return .jump
            }
        }
        let hint = regionHint.lowercased()
        if hint.contains("gravity") || hint.contains("enduro") || hint.contains("downhill") {
            return .gravity
        }
        if hint.contains("xc") || hint.contains("cross") {
            return .crossCountry
        }
        return .trail
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Trip Planner").font(.headline)
                        Text(activeProfile == nil ? "Create/select a profile to tailor regional bike picks." : "Using profile: \(activeProfileSummary)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        if let profile = activeProfile {
                            HStack(spacing: 8) {
                                Label(profile.style, systemImage: "person.fill")
                                Label(RiderProfile.inferredCategory(for: profile.style) == "Any" ? "Any category" : RiderProfile.inferredCategory(for: profile.style), systemImage: "line.3.horizontal.decrease.circle")
                                Label(profile.budgetCap > 0 ? Formatting.currency(profile.budgetCap) : "No budget cap", systemImage: "dollarsign.circle")
                            }
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(Color.rOrangeDark)
                        }
                        HStack {
                            TextField("Destination", text: $destination)
                                .textFieldStyle(.roundedBorder)
                                .disabled(isSearchingDestination)
                            Button {
                                Task { await searchDestination() }
                            } label: {
                                if isSearchingDestination {
                                    ProgressView()
                                        .tint(.white)
                                } else {
                                    Text("Search")
                                }
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(Color.rOrange)
                            .disabled(isSearchingDestination || destination.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        }
                        if showAutocomplete {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("Suggestions")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.secondary)
                                ForEach(Array(searchCompleter.completions.prefix(5))) { completion in
                                    Button {
                                        Task {
                                            await searchDestination(
                                                query: completion.queryText,
                                                displayName: completion.title,
                                                expectedSubtitle: completion.subtitle
                                            )
                                        }
                                    } label: {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(completion.title)
                                                .font(.subheadline.weight(.semibold))
                                            if !completion.subtitle.isEmpty {
                                                Text(completion.subtitle)
                                                    .font(.caption)
                                                    .foregroundStyle(.secondary)
                                            }
                                        }
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                    }
                                    .buttonStyle(.plain)
                                    .accessibilityLabel("Suggestion \(completion.title), \(completion.subtitle)")
                                    .padding(.vertical, 2)
                                    Divider()
                                }
                            }
                            .padding(10)
                            .background(Color.rBackground.opacity(0.55))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .zIndex(3)
                        }
                        if !recentSearches.isEmpty {
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Text("Recent searches")
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(.secondary)
                                    Spacer()
                                    Button("Clear") {
                                        persistRecentSearches([])
                                    }
                                    .font(.caption)
                                    .accessibilityLabel("Clear recent searches")
                                }
                                ScrollView(.horizontal, showsIndicators: false) {
                                    HStack {
                                        ForEach(recentSearches, id: \.self) { recent in
                                            HStack(spacing: 6) {
                                                Button(recent) {
                                                    Task { await searchDestination(query: recent, displayName: recent) }
                                                }
                                                .buttonStyle(.bordered)
                                                Button {
                                                    removeRecentSearch(recent)
                                                } label: {
                                                    Image(systemName: "xmark.circle.fill")
                                                        .foregroundStyle(.secondary)
                                                }
                                                .buttonStyle(.plain)
                                                .accessibilityLabel("Remove recent search \(recent)")
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        Text(searchStatus)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding()
                    .background(Color.rCard)
                    .clipShape(RoundedRectangle(cornerRadius: 14))

                    Map(position: $position)
                        .frame(height: 300)
                        .clipShape(RoundedRectangle(cornerRadius: 12))

                    if !nearbyRidingAreas.isEmpty || lastSearchedDestination != nil {
                        sectionCard(title: "Trails \(nearbyRidingAreas.isEmpty ? "for" : "near") \(destination.isEmpty ? regionHint : destination)") {
                            if !trailforksTrails.isEmpty {
                                Text("Local trails from Trailforks")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.secondary)
                                ForEach(trailforksTrails.prefix(8)) { trail in
                                    trailforksTrailCard(trail)
                                }
                            } else if !nearbyRidingAreas.isEmpty {
                                Text("Local trails")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.secondary)
                                ForEach(nearbyRidingAreas.prefix(5), id: \.self) { area in
                                    trailAreaCard(area)
                                }
                            } else {
                                Text("No specific local trails found yet. Search a suburb or trail network to see nearby riding spots.")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            if let trailforksStatus, !trailforksStatus.isEmpty {
                                Text(trailforksStatus)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                            VStack(alignment: .leading, spacing: 6) {
                                Divider().padding(.vertical, 2)
                                Text("Recommended bike styles for these trails")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.secondary)
                                stylePills(areaBikeStyles.map(\.name))
                            }
                            if let coord = destinationPlacemark?.coordinate,
                               let url = trailforksURL(lat: coord.latitude, lon: coord.longitude) {
                                Link(destination: url) {
                                    HStack(spacing: 6) {
                                        Image(systemName: "map.fill")
                                        Text("Browse all trails on Trailforks")
                                            .fontWeight(.semibold)
                                    }
                                    .frame(maxWidth: .infinity)
                                }
                                .buttonStyle(.borderedProminent)
                                .tint(Color.rOrange)
                            }
                        }
                    }

                    if lastSearchedDestination != nil {
                        rideReadinessCard
                    }

                    sectionCard(title: "Recommended Bikes for \(regionHint)") {
                        if !recommendationTrailSignals.isEmpty {
                            stylePills(recommendationTrailSignals)
                        }
                        if recommendationResult.usedProfileFallback {
                            Text("Showing area matches. Your active profile filters were too strict for this location.")
                                .font(.caption)
                                .foregroundStyle(Color.rOrangeDark)
                        }
                        if recommendedBikes.isEmpty {
                            Text("No bikes match this area and your active profile settings yet. Try broadening budget or category filters.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        } else {
                            ForEach(recommendedBikes.prefix(6)) { bike in
                                Button {
                                    selectedTripBike = bike
                                } label: {
                                    VStack(alignment: .leading, spacing: 8) {
                                        HStack(alignment: .top) {
                                            Text("\(bike.brand) \(bike.model)")
                                                .font(.subheadline.weight(.semibold))
                                                .foregroundStyle(.primary)
                                            Spacer()
                                            Text(Formatting.currency(bike.bestPrice))
                                                .font(.caption.weight(.semibold))
                                                .foregroundStyle(Color.rGreen)
                                        }
                                        stylePills(recommendationPills(for: bike))
                                        HStack {
                                            Text("Match score \(areaMatchScore(for: bike))")
                                                .font(.caption2.weight(.semibold))
                                                .foregroundStyle(Color.rOrangeDark)
                                            Spacer()
                                            Image(systemName: "chevron.right")
                                                .font(.caption.weight(.semibold))
                                                .foregroundStyle(.secondary)
                                        }
                                    }
                                    .padding(10)
                                    .background(Color.rBackground.opacity(0.55))
                                    .clipShape(RoundedRectangle(cornerRadius: 10))
                                }
                                .buttonStyle(.plain)
                            }

                            Button {
                                applyAreaFiltersAndSearch()
                            } label: {
                                HStack {
                                    Image(systemName: "magnifyingglass")
                                    Text("Search all bikes for \(regionHint)")
                                }
                                .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(Color.rOrange)
                            .padding(.top, 4)
                        }
                    }

                    if lastSearchedDestination != nil {
                        sectionCard(title: "Bike Shops Near \(destination)") {
                            if nearbyShops.isEmpty {
                                HStack(spacing: 10) {
                                    Image(systemName: "bicycle")
                                        .foregroundStyle(.secondary)
                                    Text("No bike shops found within 80km of this location.")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                .padding(10)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color.rBackground.opacity(0.55))
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                            } else {
                                ForEach(nearbyShops.prefix(8), id: \.self) { shop in
                                    shopCard(shop)
                                }
                            }
                        }
                    }

                    if !watchlistBikes.isEmpty {
                        sectionCard(title: "Your Saved Bikes") {
                            Text("Show this list to any local shop — ask about ordering, demos, or second-hand options.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            ForEach(watchlistBikes) { bike in
                                Button {
                                    selectedTripBike = bike
                                } label: {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text("\(bike.brand) \(bike.model)")
                                                .font(.subheadline.weight(.semibold))
                                                .foregroundStyle(.primary)
                                            Text("\(bike.category) · \(Formatting.currency(bike.bestPrice))")
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                        }
                                        Spacer()
                                        Image(systemName: "chevron.right")
                                            .font(.caption.weight(.semibold))
                                            .foregroundStyle(.secondary)
                                    }
                                    .padding(10)
                                    .background(Color.rBackground.opacity(0.55))
                                    .clipShape(RoundedRectangle(cornerRadius: 10))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
            }
            .background(Color.rBackground.ignoresSafeArea())
            .navigationTitle("Trip Planner")
            .navigationBarTitleDisplayMode(.inline)
            .onChange(of: destination) { _, newValue in
                searchCompleter.updateQuery(newValue)
            }
            .sheet(item: $selectedTripBike) { bike in
                BikeDetailView(bike: bike)
            }
        }
    }

    private func applyAreaFiltersAndSearch() {
        filterStore.state.tailorToProfile = false
        switch locationRideType {
        case .gravity:
            filterStore.state.category = "Enduro"
            filterStore.state.activeTravelRanges = ["150-160mm", "160-180mm"]
        case .crossCountry:
            filterStore.state.category = "XC / Cross-Country"
            filterStore.state.activeTravelRanges = ["100-120mm", "130-140mm"]
        case .jump:
            filterStore.state.category = "Hardtail"
            filterStore.state.activeTravelRanges = ["Hardtail"]
        case .trail:
            filterStore.state.category = "Trail"
            filterStore.state.activeTravelRanges = ["130-140mm", "150-160mm"]
        case .other:
            filterStore.state.category = "Any"
            filterStore.state.activeTravelRanges = []
        }
        appState.activeTab = .results
    }

    private func sectionCard<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
            content()
        }
        .padding()
        .background(Color.rCard)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private func stylePills(_ labels: [String]) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(labels, id: \.self) { label in
                    Text(label)
                        .font(.caption.weight(.semibold))
                        .lineLimit(1)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Color.rOrange.opacity(0.12))
                        .foregroundStyle(Color.rOrangeDark)
                        .clipShape(Capsule())
                }
            }
        }
    }

    private func recommendationPills(for bike: Bike) -> [String] {
        var pills = [bike.category, bike.travel]
        if bike.suspension == "Hardtail" {
            pills.append("Hardtail")
        }
        if bike.isEbike {
            pills.append("eMTB")
        }
        return Array(pills.prefix(4))
    }

    private func areaMatchScore(for bike: Bike) -> Int {
        var score = 0
        let travel = bike.travelMM
        let category = bike.category.lowercased()
        let isHardtail = bike.suspension.lowercased() == "hardtail"

        switch locationRideType {
        case .gravity:
            if category.contains("downhill") || category.contains("enduro") { score += 60 }
            if travel >= 160 { score += 25 }
            if !isHardtail { score += 15 }
        case .crossCountry:
            if category.contains("xc") || category.contains("cross-country") { score += 55 }
            if isHardtail { score += 20 }
            if travel <= 130 { score += 25 }
        case .jump:
            if isHardtail { score += 45 }
            if bike.wheel == "26\"" || bike.wheel == "27.5\"" { score += 30 }
            if travel <= 140 { score += 25 }
        case .trail:
            if category.contains("trail") || category.contains("all-mountain") { score += 50 }
            if (130...160).contains(travel) { score += 25 }
            if bike.isEbike { score += 10 }
            if !isHardtail { score += 10 }
        case .other:
            if category.contains("trail") || category.contains("all-mountain") || category.contains("xc") { score += 40 }
            if (120...160).contains(travel) { score += 20 }
            if bike.isEbike { score += 15 }
        }

        let signalBlob = recommendationTrailSignals.joined(separator: " ").lowercased()
        if signalBlob.contains("gravity"), category.contains("enduro") || category.contains("downhill") {
            score += 20
        }
        if signalBlob.contains("pedal-heavy"), category.contains("xc") || isHardtail {
            score += 15
        }
        if signalBlob.contains("jumps"), isHardtail {
            score += 15
        }
        if signalBlob.contains("flowing"), category.contains("trail") || category.contains("all-mountain") {
            score += 15
        }

        return score
    }

    private func locationRow(name: String, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(name)
                .font(.subheadline.weight(.semibold))
            if !subtitle.isEmpty {
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        }
        .padding(10)
        .background(Color.rBackground.opacity(0.55))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func trailAreaCard(_ area: MKMapItem) -> some View {
        let coord = area.placemark.coordinate
        return HStack(alignment: .top, spacing: 8) {
            VStack(alignment: .leading, spacing: 3) {
                Text(area.name ?? "Riding Area")
                    .font(.subheadline.weight(.semibold))
                if let subtitle = area.placemark.title, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }
            Spacer()
            if let url = trailforksURL(lat: coord.latitude, lon: coord.longitude) {
                Link(destination: url) {
                    HStack(spacing: 4) {
                        Text("Trailforks")
                            .font(.caption.weight(.semibold))
                        Image(systemName: "arrow.up.right")
                            .font(.caption2.weight(.bold))
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(Color.rOrange.opacity(0.15))
                    .foregroundStyle(Color.rOrange)
                    .clipShape(Capsule())
                }
            }
        }
        .padding(10)
        .background(Color.rBackground.opacity(0.55))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func trailforksTrailCard(_ trail: TrailforksTrail) -> some View {
        HStack(alignment: .top, spacing: 8) {
            VStack(alignment: .leading, spacing: 3) {
                Text(trail.name)
                    .font(.subheadline.weight(.semibold))
                if let difficulty = trail.difficulty, !difficulty.isEmpty {
                    Text("Difficulty: \(difficulty)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            if let url = trail.linkURL {
                Link(destination: url) {
                    HStack(spacing: 4) {
                        Text("Trailforks")
                            .font(.caption.weight(.semibold))
                        Image(systemName: "arrow.up.right")
                            .font(.caption2.weight(.bold))
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(Color.rOrange.opacity(0.15))
                    .foregroundStyle(Color.rOrange)
                    .clipShape(Capsule())
                }
            }
        }
        .padding(10)
        .background(Color.rBackground.opacity(0.55))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func trailforksURL(lat: Double, lon: Double) -> URL? {
        URL(string: "https://www.trailforks.com/trails/?lat=\(lat)&lon=\(lon)&context=region")
    }

    @ViewBuilder
    private var rideReadinessCard: some View {
        sectionCard(title: "Ride Readiness — \(regionHint)") {
            let essential = terrainGearItems.filter(\.essential)
            let remaining = essential.filter { !ownedGearIds.contains($0.id) }.count
            if allEssentialGearOwned {
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.seal.fill")
                        .foregroundStyle(Color.rGreen)
                    Text("You're ready to ride!")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.rGreen)
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.rGreen.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 10))
            } else {
                HStack(spacing: 8) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(Color.rOrange)
                    Text("\(remaining) essential item\(remaining == 1 ? "" : "s") still needed")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.rOrange)
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.rOrangeLight)
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            Text("Tap each item you already own:")
                .font(.caption)
                .foregroundStyle(.secondary)
            if !essential.isEmpty {
                Text("Essential")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                ForEach(essential) { item in gearCheckRow(item) }
            }
            let recommended = terrainGearItems.filter { !$0.essential }
            if !recommended.isEmpty {
                Text("Recommended")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .padding(.top, 4)
                ForEach(recommended) { item in gearCheckRow(item) }
            }
        }
    }

    private func gearCheckRow(_ item: TripGearItem) -> some View {
        let owned = ownedGearIds.contains(item.id)
        return Button {
            toggleOwnedGear(item.id)
        } label: {
            HStack(spacing: 10) {
                Image(systemName: owned ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(owned ? Color.rGreen : Color.secondary)
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.name)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(owned ? Color.rGreen : Color.primary)
                    Text(item.why)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
            }
            .padding(10)
            .background(owned ? Color.rGreen.opacity(0.08) : Color.rBackground.opacity(0.55))
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
    }

    private func toggleOwnedGear(_ id: String) {
        var ids = ownedGearIds
        if ids.contains(id) { ids.remove(id) } else { ids.insert(id) }
        guard let data = try? JSONEncoder().encode(Array(ids)),
              let text = String(data: data, encoding: .utf8) else { return }
        ownedGearIdsData = text
    }

    private func searchDestination(query: String? = nil, displayName: String? = nil, expectedSubtitle: String? = nil) async {
        isSearchingDestination = true
        defer { isSearchingDestination = false }
        var effectiveQuery = query
        var effectiveDisplayName = displayName
        var effectiveSubtitle = expectedSubtitle
        if query == nil, displayName == nil, expectedSubtitle == nil,
           let bestCompletion = bestAutocompleteMatch(for: destination) {
            // One tap on Search should resolve to the best visible suggestion.
            effectiveQuery = bestCompletion.queryText
            effectiveDisplayName = bestCompletion.title
            effectiveSubtitle = bestCompletion.subtitle
        }

        let searchText = (effectiveQuery ?? destination).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !searchText.isEmpty else { return }
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = searchText
        request.resultTypes = [.address, .pointOfInterest]
        do {
            let response = try await MKLocalSearch(request: request).start()
            let selectedItem = selectBestDestination(
                from: response.mapItems,
                query: searchText,
                displayName: effectiveDisplayName,
                expectedSubtitle: effectiveSubtitle
            )
            if let item = selectedItem {
                let coordinate = item.placemark.coordinate
                lastSearchedDestination = item
                destinationPlacemark = item.placemark
                let resolvedLabel = formatDestinationLabel(for: item, fallback: effectiveDisplayName ?? searchText)
                destination = resolvedLabel
                searchCompleter.clear()
                addRecentSearch(resolvedLabel)
                position = .region(
                    MKCoordinateRegion(center: coordinate, span: MKCoordinateSpan(latitudeDelta: 0.22, longitudeDelta: 0.22))
                )
                searchStatus = "Destination found: \(resolvedLabel)"
                inferRegionHint(from: resolvedLabel)
                await searchNearbyRidingAreas(around: coordinate)
                await searchNearbyShops(around: coordinate)
            } else {
                searchStatus = "No destination match found."
            }
        } catch {
            searchStatus = "Search failed. Try a more specific location."
        }
    }

    private func inferRegionHint(from query: String) {
        let q = query.lowercased()
        if q.contains("bike park") || q.contains("downhill") || q.contains("thredbo") {
            regionHint = "Enduro / Gravity"
        } else if q.contains("xc") || q.contains("cross-country") {
            regionHint = "XC"
        } else {
            regionHint = "Trail"
        }
    }

    private func searchNearbyShops(around coordinate: CLLocationCoordinate2D) async {
        let region = MKCoordinateRegion(
            center: coordinate,
            span: MKCoordinateSpan(latitudeDelta: 0.45, longitudeDelta: 0.45)
        )
        async let r1 = fetchMapItems(query: "bike shop", region: region, resultTypes: .pointOfInterest)
        async let r2 = fetchMapItems(query: "bicycle shop", region: region, resultTypes: .pointOfInterest)
        async let r3 = fetchMapItems(query: "cycling store", region: region, resultTypes: .pointOfInterest)
        async let rent1 = fetchMapItems(query: "mountain bike hire", region: region, resultTypes: .pointOfInterest)
        async let rent2 = fetchMapItems(query: "bike rental", region: region, resultTypes: .pointOfInterest)
        async let rent3 = fetchMapItems(query: "bicycle hire", region: region, resultTypes: .pointOfInterest)

        let combined = await r1 + r2 + r3
        let rentals = await rent1 + rent2 + rent3

        let rentalSanitized = sanitizeNearbyResults(rentals, around: coordinate, maxDistanceKM: 80)
        rentalShopKeys = Set(rentalSanitized.compactMap { rentalKey(for: $0) })
        nearbyShops = sanitizeNearbyResults(combined + rentals, around: coordinate, maxDistanceKM: 80)
    }

    private func distanceText(for shop: MKMapItem) -> String? {
        guard let destLocation = destinationPlacemark?.location else { return nil }
        let shopLoc = CLLocation(latitude: shop.placemark.coordinate.latitude, longitude: shop.placemark.coordinate.longitude)
        let km = destLocation.distance(from: shopLoc) / 1000
        return km < 1 ? "\(Int(km * 1000)) m from destination" : String(format: "%.1f km from destination", km)
    }

    private func rentalKey(for item: MKMapItem) -> String? {
        guard let name = item.name else { return nil }
        let lat = (item.placemark.coordinate.latitude * 100).rounded() / 100
        let lon = (item.placemark.coordinate.longitude * 100).rounded() / 100
        return "\(name.lowercased().filter { $0.isLetter || $0.isNumber })-\(lat)-\(lon)"
    }

    private func isRentalShop(_ shop: MKMapItem) -> Bool {
        if let key = rentalKey(for: shop), rentalShopKeys.contains(key) { return true }
        let name = (shop.name ?? "").lowercased()
        return name.contains("hire") || name.contains("rental") || name.contains("rent")
    }

    private func searchNearbyRidingAreas(around coordinate: CLLocationCoordinate2D) async {
        await searchTrailforksTrails(around: coordinate)

        let region = MKCoordinateRegion(
            center: coordinate,
            span: MKCoordinateSpan(latitudeDelta: 0.6, longitudeDelta: 0.6)
        )
        let placeHint = destination.trimmingCharacters(in: .whitespacesAndNewlines)
        let queries = [
            "mountain bike trail \(placeHint)",
            "bike park \(placeHint)",
            "singletrack \(placeHint)",
            "trail network \(placeHint)",
            "mtb trails \(placeHint)"
        ]

        async let q1 = fetchMapItems(query: queries[0], region: region, resultTypes: [.pointOfInterest, .address])
        async let q2 = fetchMapItems(query: queries[1], region: region, resultTypes: [.pointOfInterest, .address])
        async let q3 = fetchMapItems(query: queries[2], region: region, resultTypes: [.pointOfInterest, .address])
        async let q4 = fetchMapItems(query: queries[3], region: region, resultTypes: [.pointOfInterest, .address])
        async let q5 = fetchMapItems(query: queries[4], region: region, resultTypes: [.pointOfInterest, .address])

        let combined = await q1 + q2 + q3 + q4 + q5
        let sanitized = sanitizeNearbyResults(combined, around: coordinate, maxDistanceKM: 180)
        let trailFirst = sanitized.sorted { lhs, rhs in
            let lTrail = trailRelevanceScore(for: lhs)
            let rTrail = trailRelevanceScore(for: rhs)
            if lTrail == rTrail {
                let lDist = CLLocation(latitude: lhs.placemark.coordinate.latitude, longitude: lhs.placemark.coordinate.longitude)
                    .distance(from: CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude))
                let rDist = CLLocation(latitude: rhs.placemark.coordinate.latitude, longitude: rhs.placemark.coordinate.longitude)
                    .distance(from: CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude))
                return lDist < rDist
            }
            return lTrail > rTrail
        }
        nearbyRidingAreas = Array(trailFirst.prefix(10))
    }

    private func searchTrailforksTrails(around coordinate: CLLocationCoordinate2D) async {
        guard !TrailforksConfig.appID.isEmpty, !TrailforksConfig.appSecret.isEmpty else {
            trailforksTrails = []
            trailforksStatus = nil
            return
        }

        var components = URLComponents(string: "https://www.trailforks.com/api/1/trails")
        components?.queryItems = [
            URLQueryItem(name: "app_id", value: TrailforksConfig.appID),
            URLQueryItem(name: "app_secret", value: TrailforksConfig.appSecret),
            URLQueryItem(name: "lat", value: String(coordinate.latitude)),
            URLQueryItem(name: "lon", value: String(coordinate.longitude)),
            URLQueryItem(name: "rows", value: "25"),
            URLQueryItem(name: "scope", value: "full")
        ]
        guard let url = components?.url else {
            trailforksTrails = []
            trailforksStatus = "Unable to build Trailforks request."
            return
        }

        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                trailforksTrails = []
                trailforksStatus = "Trailforks request failed. You can still browse trails directly on Trailforks."
                return
            }
            let decoded = try JSONDecoder().decode(TrailforksTrailResponse.self, from: data)
            let mapped = (decoded.data ?? []).compactMap { item -> TrailforksTrail? in
                let name = item.title ?? item.name
                guard let name, !name.isEmpty else { return nil }
                let link = item.url ?? item.alias.map { "https://www.trailforks.com/trails/\($0)/" }
                return TrailforksTrail(
                    id: item.trailID.map(String.init) ?? "\(name)-\(item.latitude ?? 0)-\(item.longitude ?? 0)",
                    name: name,
                    difficulty: item.difficulty,
                    linkURL: link.flatMap(URL.init(string:)),
                    latitude: item.latitude,
                    longitude: item.longitude
                )
            }
            trailforksTrails = mapped
            trailforksStatus = mapped.isEmpty ? "Trailforks returned no nearby trails for this location." : nil
        } catch {
            trailforksTrails = []
            trailforksStatus = "Unable to load trails from Trailforks right now."
        }
    }

    private func fetchMapItems(query: String, region: MKCoordinateRegion, resultTypes: MKLocalSearch.ResultType) async -> [MKMapItem] {
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = query
        request.resultTypes = resultTypes
        request.region = region
        return (try? await MKLocalSearch(request: request).start().mapItems) ?? []
    }

    private func trailRelevanceScore(for item: MKMapItem) -> Int {
        let text = [item.name, item.placemark.title]
            .compactMap { $0?.lowercased() }
            .joined(separator: " ")
        var score = 0
        if text.contains("trail") { score += 30 }
        if text.contains("bike park") || text.contains("mtb") || text.contains("mountain bike") { score += 35 }
        if text.contains("singletrack") { score += 25 }
        if text.contains("reserve") || text.contains("forest") || text.contains("national park") { score += 10 }
        return score
    }

    private func shopCard(_ shop: MKMapItem) -> some View {
        let offersRentals = isRentalShop(shop)
        return VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(shop.name ?? "Bike Shop")
                            .font(.subheadline.weight(.semibold))
                        if offersRentals {
                            Text("Rentals")
                                .font(.caption2.weight(.bold))
                                .padding(.horizontal, 7).padding(.vertical, 3)
                                .background(Color.rGreen.opacity(0.18))
                                .foregroundStyle(Color.rGreen)
                                .clipShape(Capsule())
                        }
                    }
                    if let address = shop.placemark.title, !address.isEmpty {
                        Text(address)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if let dist = distanceText(for: shop) {
                        Text(dist)
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(Color.rOrangeDark)
                    }
                }
                Spacer()
                Image(systemName: "mappin.and.ellipse")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.rOrange)
            }

            if let phone = shop.phoneNumber, !phone.isEmpty {
                contactRow(icon: "phone.fill", text: phone)
            }
            if let url = shop.url {
                contactRow(icon: "globe", text: url.host() ?? url.absoluteString)
            }

            ViewThatFits {
                HStack(spacing: 8) {
                    if let phone = shop.phoneNumber, let phoneURL = phoneCallURL(from: phone) {
                        Button("Call") { openURL(phoneURL) }
                            .buttonStyle(.bordered)
                    }
                    if let website = shop.url {
                        Button("Website") { openURL(website) }
                            .buttonStyle(.bordered)
                    }
                    Button("Directions") { openDirections(to: shop) }
                        .buttonStyle(.borderedProminent)
                        .tint(Color.rOrange)
                }
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 8) {
                        if let phone = shop.phoneNumber, let phoneURL = phoneCallURL(from: phone) {
                            Button("Call") { openURL(phoneURL) }
                                .buttonStyle(.bordered)
                        }
                        if let website = shop.url {
                            Button("Website") { openURL(website) }
                                .buttonStyle(.bordered)
                        }
                    }
                    Button("Directions") { openDirections(to: shop) }
                        .buttonStyle(.borderedProminent)
                        .tint(Color.rOrange)
                }
            }
        }
        .padding(10)
        .background(Color.rBackground.opacity(0.55))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func contactRow(icon: String, text: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(Color.rOrangeDark)
            Text(text)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
    }

    private func phoneCallURL(from phone: String) -> URL? {
        let digits = phone.filter(\.isNumber)
        guard !digits.isEmpty else { return nil }
        return URL(string: "tel://\(digits)")
    }

    private func openDirections(to shop: MKMapItem) {
        let source = MKMapItem.forCurrentLocation()
        let launchOptions: [String: Any] = [
            MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDriving
        ]
        let opened = MKMapItem.openMaps(
            with: [source, shop],
            launchOptions: launchOptions
        )

        if !opened {
            let destination = "\(shop.placemark.coordinate.latitude),\(shop.placemark.coordinate.longitude)"
            let encodedName = (shop.name ?? "Bike Shop")
                .addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "Bike%20Shop"
            if let fallback = URL(string: "http://maps.apple.com/?saddr=Current%20Location&daddr=\(destination)&q=\(encodedName)") {
                openURL(fallback)
            }
        }
    }

    private func addRecentSearch(_ query: String) {
        let clean = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }
        let normalizedClean = normalizeRecentSearch(clean)
        var updated = recentSearches.filter { existing in
            normalizeRecentSearch(existing) != normalizedClean
        }
        updated.insert(clean, at: 0)
        persistRecentSearches(Array(updated.prefix(8)))
    }

    private func removeRecentSearch(_ query: String) {
        persistRecentSearches(recentSearches.filter { $0 != query })
    }

    private func persistRecentSearches(_ items: [String]) {
        guard let data = try? JSONEncoder().encode(items),
              let text = String(data: data, encoding: .utf8) else { return }
        recentSearchesData = text
    }

    private func bestAutocompleteMatch(for text: String) -> LocationSuggestion? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !trimmed.isEmpty else { return nil }

        if let exact = searchCompleter.completions.first(where: {
            $0.title.lowercased() == trimmed || $0.queryText.lowercased() == trimmed
        }) {
            return exact
        }

        return searchCompleter.completions.first(where: {
            $0.title.lowercased().hasPrefix(trimmed) || $0.queryText.lowercased().hasPrefix(trimmed)
        }) ?? searchCompleter.completions.first
    }

    private func formatDestinationLabel(for item: MKMapItem, fallback: String) -> String {
        let base = item.name?.trimmingCharacters(in: .whitespacesAndNewlines) ?? fallback
        let locality = item.placemark.locality?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let admin = item.placemark.administrativeArea?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let country = item.placemark.countryCode?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        var suffixParts: [String] = []
        if !locality.isEmpty && locality.caseInsensitiveCompare(base) != .orderedSame {
            suffixParts.append(locality)
        }
        if !admin.isEmpty && admin.caseInsensitiveCompare(base) != .orderedSame {
            suffixParts.append(admin)
        }
        if suffixParts.isEmpty && !country.isEmpty {
            suffixParts.append(country)
        }
        guard !suffixParts.isEmpty else { return base }
        return "\(base), \(suffixParts.joined(separator: ", "))"
    }

    private func normalizeRecentSearch(_ value: String) -> String {
        value
            .lowercased()
            .replacingOccurrences(of: "[^a-z0-9]", with: "", options: .regularExpression)
    }

    private func selectBestDestination(from items: [MKMapItem], query: String, displayName: String?, expectedSubtitle: String?) -> MKMapItem? {
        guard !items.isEmpty else { return nil }
        let normalizedQuery = normalizeSearchText(query)
        let normalizedDisplay = normalizeSearchText(displayName ?? "")
        let normalizedExpected = normalizeSearchText(expectedSubtitle ?? "")

        return items
            .map { item in (item: item, score: destinationScore(item, query: normalizedQuery, displayName: normalizedDisplay, expectedSubtitle: normalizedExpected)) }
            .max(by: { $0.score < $1.score })?
            .item
    }

    private func destinationScore(_ item: MKMapItem, query: String, displayName: String, expectedSubtitle: String) -> Int {
        var score = 0
        let name = normalizeSearchText(item.name ?? "")
        let title = normalizeSearchText(item.placemark.title ?? "")
        let locality = normalizeSearchText(item.placemark.locality ?? "")
        let admin = normalizeSearchText(item.placemark.administrativeArea ?? "")
        let countryCode = normalizeSearchText(item.placemark.isoCountryCode ?? "")

        if !query.isEmpty {
            if name == query { score += 80 }
            if name.hasPrefix(query) { score += 55 }
            if title.contains(query) { score += 35 }
            if locality == query || locality.contains(query) { score += 40 }
        }
        if !displayName.isEmpty {
            if name == displayName { score += 45 }
            if name.contains(displayName) { score += 25 }
        }
        if !expectedSubtitle.isEmpty {
            if title.contains(expectedSubtitle) { score += 30 }
            if locality.contains(expectedSubtitle) || admin.contains(expectedSubtitle) { score += 20 }
        }

        if countryCode == "au" { score += 10 }

        let location = item.placemark.location
        if let location, let destinationPlacemark {
            let prior = destinationPlacemark.location
            if let prior {
                let distanceKM = prior.distance(from: location) / 1000.0
                if distanceKM < 100 { score += 5 }
            }
        }
        return score
    }

    private func normalizeSearchText(_ value: String) -> String {
        value
            .lowercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func sanitizeNearbyResults(_ items: [MKMapItem], around coordinate: CLLocationCoordinate2D, maxDistanceKM: Double) -> [MKMapItem] {
        let centerLocation = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
        let filtered = items.filter { isRelevant($0, around: coordinate, maxDistanceKM: maxDistanceKM) }
        let deduped = Dictionary(
            filtered.map {
                (
                    key: "\(($0.name ?? "").lowercased())-\($0.placemark.coordinate.latitude.rounded(toPlaces: 4))-\($0.placemark.coordinate.longitude.rounded(toPlaces: 4))",
                    value: $0
                )
            },
            uniquingKeysWith: { first, _ in first }
        ).values

        return deduped.sorted {
            let lhs = CLLocation(latitude: $0.placemark.coordinate.latitude, longitude: $0.placemark.coordinate.longitude)
            let rhs = CLLocation(latitude: $1.placemark.coordinate.latitude, longitude: $1.placemark.coordinate.longitude)
            return lhs.distance(from: centerLocation) < rhs.distance(from: centerLocation)
        }
    }

    private func isRelevant(_ item: MKMapItem, around coordinate: CLLocationCoordinate2D, maxDistanceKM: Double) -> Bool {
        let center = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
        let candidate = CLLocation(latitude: item.placemark.coordinate.latitude, longitude: item.placemark.coordinate.longitude)
        let distanceKM = center.distance(from: candidate) / 1000.0
        guard distanceKM <= maxDistanceKM else { return false }

        if let destinationPlacemark {
            let destinationCountryCode = destinationPlacemark.isoCountryCode?.lowercased()
            let itemCountryCode = item.placemark.isoCountryCode?.lowercased()
            if let destinationCountryCode, let itemCountryCode, destinationCountryCode != itemCountryCode {
                return false
            }
        }

        return true
    }
}

private extension Double {
    func rounded(toPlaces places: Int) -> Double {
        let factor = pow(10.0, Double(places))
        return (self * factor).rounded() / factor
    }
}

private struct AreaBikeStyle: Identifiable {
    let id = UUID()
    let name: String
}

private enum TrailforksConfig {
    // Configure with Trailforks API credentials when available.
    static let appID = ""
    static let appSecret = ""
}

private struct TrailforksTrail: Identifiable {
    let id: String
    let name: String
    let difficulty: String?
    let linkURL: URL?
    let latitude: Double?
    let longitude: Double?
}

private struct TrailforksTrailResponse: Decodable {
    let error: Int?
    let message: String?
    let data: [TrailforksTrailDTO]?
}

private struct TrailforksTrailDTO: Decodable {
    let trailID: Int?
    let title: String?
    let name: String?
    let alias: String?
    let url: String?
    let difficulty: String?
    let latitude: Double?
    let longitude: Double?

    enum CodingKeys: String, CodingKey {
        case trailID = "trailid"
        case title
        case name
        case alias
        case url
        case difficulty
        case latitude = "lat"
        case longitude = "lon"
    }
}

private struct TripGearItem: Identifiable {
    let id: String
    let name: String
    let icon: String
    let why: String
    let essential: Bool
}

private struct LocationSuggestion: Identifiable, Hashable {
    let id: String
    let title: String
    let subtitle: String

    var queryText: String {
        subtitle.isEmpty ? title : "\(title), \(subtitle)"
    }
}

private final class LocationSearchCompleter: NSObject, ObservableObject, MKLocalSearchCompleterDelegate {
    @Published var completions: [LocationSuggestion] = []
    private let completer = MKLocalSearchCompleter()

    override init() {
        super.init()
        completer.delegate = self
        completer.resultTypes = .address
    }

    func updateQuery(_ query: String) {
        completer.queryFragment = query
    }

    func clear() {
        completer.queryFragment = ""
        completions = []
    }

    func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        let mapped = completer.results.enumerated().map { index, result in
            LocationSuggestion(
                id: "\(result.title)|\(result.subtitle)|\(index)",
                title: result.title,
                subtitle: result.subtitle
            )
        }
        DispatchQueue.main.async {
            self.completions = mapped
        }
    }

    func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        DispatchQueue.main.async {
            self.completions = []
        }
    }
}
