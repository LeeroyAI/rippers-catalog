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
    @State private var nearbyShops: [MKMapItem] = []
    @State private var lastSearchedDestination: MKMapItem?
    @State private var destinationPlacemark: MKPlacemark?
    @AppStorage("rippers.tripPlannerRecentSearches") private var recentSearchesData: String = "[]"
    @State private var selectedTripBike: Bike?
    @AppStorage("rippers.ownedGearIds") private var ownedGearIdsData: String = "[]"
    @Query private var watchlistItems: [WatchlistItem]

    var activeProfile: RiderProfile? { profiles.first(where: { $0.isActive }) }
    private var activeProfileSummary: String {
        guard let profile = activeProfile else { return "No active profile" }
        let category = profile.preferredCategory == "Any" ? "Any category" : profile.preferredCategory
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

            if profile.preferredCategory != "Any" {
                profiledBikes = profiledBikes.filter { bike in
                    bike.category == profile.preferredCategory ||
                    (profile.preferredCategory == "Hardtail" && bike.suspension == "Hardtail")
                }
            }
            if profile.budgetCap > 0 {
                profiledBikes = profiledBikes.filter { ($0.bestPrice ?? .greatestFiniteMagnitude) <= profile.budgetCap }
            }
            let style = RidingDisciplineKind.from(profile.style)
            if style == .gravity {
                profiledBikes = profiledBikes.filter {
                    $0.suspension != "Hardtail" &&
                    ($0.category == "Enduro" || $0.travelMM >= 160)
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

        let sorted = bikes.sorted { ($0.bestPrice ?? .greatestFiniteMagnitude) < ($1.bestPrice ?? .greatestFiniteMagnitude) }
        return (sorted, usedProfileFallback)
    }
    private var recommendedBikes: [Bike] { recommendationResult.bikes }
    private var areaBikeStyles: [AreaBikeStyle] {
        switch locationRideType {
        case .gravity:
            return [
                .init(name: "Enduro", reason: "Long travel and stable geometry for steep descents."),
                .init(name: "Downhill", reason: "Maximum control and braking power for bike-park tracks."),
                .init(name: "eMTB", reason: "Helpful on long elevation days and shuttle alternatives.")
            ]
        case .crossCountry:
            return [
                .init(name: "XC / Cross-Country", reason: "Efficient climbing and fast rolling for long loops."),
                .init(name: "Trail Hardtail", reason: "Light and responsive for smoother singletrack.")
            ]
        case .trail:
            return [
                .init(name: "Trail", reason: "Balanced handling for mixed climbs, descents, and tech sections."),
                .init(name: "All-Mountain", reason: "Extra travel and confidence for rougher descents."),
                .init(name: "eMTB", reason: "Great for covering more distance in big trail networks.")
            ]
        case .jump:
            return [
                .init(name: "Hardtail", reason: "Responsive handling for pump tracks and jump lines."),
                .init(name: "Dirt Jump", reason: "Stable and playful for airtime-focused riding.")
            ]
        case .other:
            return [
                .init(name: "Trail", reason: "Balanced setup for mixed terrain when destination style is unclear."),
                .init(name: "All-Mountain", reason: "Good all-rounder for varied climbs and descents."),
                .init(name: "eMTB", reason: "Useful for covering more ground while scouting a new area.")
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
                                Label(profile.preferredCategory == "Any" ? "Any category" : profile.preferredCategory, systemImage: "line.3.horizontal.decrease.circle")
                                Label(profile.budgetCap > 0 ? Formatting.currency(profile.budgetCap) : "No budget cap", systemImage: "dollarsign.circle")
                            }
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(Color.rOrangeDark)
                        }
                        HStack {
                            TextField("Destination", text: $destination)
                                .textFieldStyle(.roundedBorder)
                            Button("Search") {
                                Task { await searchDestination() }
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(Color.rOrange)
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

                    if !nearbyRidingAreas.isEmpty {
                        sectionCard(title: "Riding Trails Near \(destination)") {
                            ForEach(nearbyRidingAreas.prefix(5), id: \.self) { area in
                                trailAreaCard(area)
                            }
                            if let coord = destinationPlacemark?.coordinate {
                                Divider()
                                    .padding(.vertical, 2)
                                if let url = trailforksURL(lat: coord.latitude, lon: coord.longitude) {
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
                    }

                    sectionCard(title: "Bike Styles for \(regionHint)") {
                        ForEach(areaBikeStyles) { style in
                            VStack(alignment: .leading, spacing: 2) {
                                Text(style.name)
                                    .font(.subheadline.weight(.semibold))
                                Text(style.reason)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            .padding(10)
                            .background(Color.rBackground.opacity(0.55))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                    }

                    if lastSearchedDestination != nil {
                        rideReadinessCard
                    }

                    sectionCard(title: "Recommended Bikes for \(regionHint)") {
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
                                    HStack {
                                        VStack(alignment: .leading) {
                                            Text("\(bike.brand) \(bike.model)")
                                                .font(.subheadline.weight(.semibold))
                                                .foregroundStyle(.primary)
                                            Text("\(bike.category) · \(bike.travel)")
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                        }
                                        Spacer()
                                        Text(Formatting.currency(bike.bestPrice))
                                            .font(.caption.weight(.semibold))
                                            .foregroundStyle(Color.rGreen)
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

                    if !nearbyShops.isEmpty {
                        sectionCard(title: "Nearby Bike Shops") {
                            ForEach(nearbyShops.prefix(6), id: \.self) { shop in
                                shopCard(shop)
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
        let searchText = (query ?? destination).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !searchText.isEmpty else { return }
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = searchText
        request.resultTypes = .address
        do {
            let response = try await MKLocalSearch(request: request).start()
            let selectedItem = selectBestDestination(
                from: response.mapItems,
                displayName: displayName,
                expectedSubtitle: expectedSubtitle
            )
            if let item = selectedItem {
                let coordinate = item.placemark.coordinate
                lastSearchedDestination = item
                destinationPlacemark = item.placemark
                destination = displayName ?? item.name ?? searchText
                searchCompleter.clear()
                addRecentSearch(destination)
                position = .region(
                    MKCoordinateRegion(center: coordinate, span: MKCoordinateSpan(latitudeDelta: 0.22, longitudeDelta: 0.22))
                )
                searchStatus = "Destination found: \(item.name ?? destination)"
                inferRegionHint(from: destination)
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
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = "bike shop"
        request.resultTypes = .pointOfInterest
        request.region = MKCoordinateRegion(center: coordinate, span: MKCoordinateSpan(latitudeDelta: 0.15, longitudeDelta: 0.15))
        do {
            let raw = try await MKLocalSearch(request: request).start().mapItems
            nearbyShops = sanitizeNearbyResults(
                raw,
                around: coordinate,
                maxDistanceKM: 60
            )
        } catch {
            nearbyShops = []
        }
    }

    private func searchNearbyRidingAreas(around coordinate: CLLocationCoordinate2D) async {
        let request = MKLocalSearch.Request()
        let hint = regionHint.lowercased()
        if hint.contains("gravity") || hint.contains("enduro") {
            request.naturalLanguageQuery = "bike park"
        } else if hint.contains("xc") || hint.contains("cross") {
            request.naturalLanguageQuery = "mountain bike trail"
        } else {
            request.naturalLanguageQuery = "trail network"
        }
        request.resultTypes = .pointOfInterest
        request.region = MKCoordinateRegion(center: coordinate, span: MKCoordinateSpan(latitudeDelta: 0.22, longitudeDelta: 0.22))
        do {
            let raw = try await MKLocalSearch(request: request).start().mapItems
            nearbyRidingAreas = sanitizeNearbyResults(
                raw,
                around: coordinate,
                maxDistanceKM: 120
            )
        } catch {
            nearbyRidingAreas = []
        }
    }

    private func shopCard(_ shop: MKMapItem) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(shop.name ?? "Bike Shop")
                        .font(.subheadline.weight(.semibold))
                    if let address = shop.placemark.title, !address.isEmpty {
                        Text(address)
                            .font(.caption)
                            .foregroundStyle(.secondary)
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
        var updated = recentSearches.filter { $0.caseInsensitiveCompare(clean) != .orderedSame }
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

    private func selectBestDestination(from items: [MKMapItem], displayName: String?, expectedSubtitle: String?) -> MKMapItem? {
        guard !items.isEmpty else { return nil }
        guard let expectedSubtitle, !expectedSubtitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return items.first
        }

        let hint = expectedSubtitle.lowercased()
        let subtitleMatch = items.first { item in
            let title = item.placemark.title?.lowercased() ?? ""
            let locality = item.placemark.locality?.lowercased() ?? ""
            let admin = item.placemark.administrativeArea?.lowercased() ?? ""
            let country = item.placemark.country?.lowercased() ?? ""
            return title.contains(hint) || hint.contains(locality) || hint.contains(admin) || hint.contains(country)
        }
        return subtitleMatch ?? items.first
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
    let reason: String
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
