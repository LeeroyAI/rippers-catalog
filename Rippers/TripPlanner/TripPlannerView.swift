import SwiftUI
import MapKit
import SwiftData

struct TripPlannerView: View {
    @EnvironmentObject private var filterStore: FilterStore
    @Query private var profiles: [RiderProfile]
    @State private var destination = ""
    @State private var position: MapCameraPosition = .region(
        MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: -33.8688, longitude: 151.2093),
            span: MKCoordinateSpan(latitudeDelta: 0.35, longitudeDelta: 0.35)
        )
    )
    @State private var searchStatus = "Find a riding destination to get profile-matched bike recommendations."
    @State private var regionHint: String = "Trail"
    @State private var nearbyShops: [MKMapItem] = []

    var activeProfile: RiderProfile? { profiles.first(where: { $0.isActive }) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Trip Planner").font(.headline)
                        Text(activeProfile == nil ? "Create/select a profile to tailor regional bike picks." : "Using profile: \(activeProfile?.name ?? "")")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        HStack {
                            TextField("Destination", text: $destination)
                                .textFieldStyle(.roundedBorder)
                            Button("Search") {
                                Task { await searchDestination() }
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(Color.rOrange)
                        }
                        Text(searchStatus)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding()
                    .background(Color.rCard)
                    .clipShape(RoundedRectangle(cornerRadius: 14))

                    Map(position: $position)
                        .frame(height: 320)
                        .clipShape(RoundedRectangle(cornerRadius: 12))

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Recommended Bikes for \(regionHint)").font(.headline)
                        ForEach(recommendedBikes.prefix(8)) { bike in
                            HStack {
                                VStack(alignment: .leading) {
                                    Text("\(bike.brand) \(bike.model)")
                                    Text("\(bike.category) · \(bike.travel)")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text(Formatting.currency(bike.bestPrice))
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(Color.rGreen)
                            }
                        }
                    }
                    .padding()
                    .background(Color.rCard)
                    .clipShape(RoundedRectangle(cornerRadius: 14))

                    if !nearbyShops.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Nearby Bike Shops").font(.headline)
                            ForEach(nearbyShops.prefix(6), id: \.self) { shop in
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(shop.name ?? "Bike Shop")
                                        .font(.subheadline.weight(.semibold))
                                    Text(shop.placemark.title ?? "")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                        .padding()
                        .background(Color.rCard)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
            }
            .background(Color.rBackground.ignoresSafeArea())
            .rippersBrandedTitle("Trip Planner")
        }
    }

    private var recommendedBikes: [Bike] {
        var bikes = filterStore.catalog
        if let profile = activeProfile {
            if profile.preferredCategory != "Any" {
                bikes = bikes.filter { $0.category == profile.preferredCategory }
            }
            if profile.budgetCap > 0 {
                bikes = bikes.filter { ($0.bestPrice ?? .greatestFiniteMagnitude) <= profile.budgetCap }
            }
            let style = RidingDisciplineKind.from(profile.style)
            if style == .gravity {
                bikes = bikes.filter {
                    $0.suspension != "Hardtail" &&
                    ($0.category == "Enduro" || $0.travelMM >= 160)
                }
            } else if style == .crossCountry {
                bikes = bikes.filter { $0.category == "XC / Cross-Country" || $0.suspension == "Hardtail" }
            } else if style == .jump {
                bikes = bikes.filter { $0.suspension == "Hardtail" || $0.wheel == "27.5\"" }
            }
        }

        let hint = regionHint.lowercased()
        if hint.contains("enduro") || hint.contains("downhill") {
            bikes = bikes.filter { $0.category == "Enduro" || $0.travel.contains("170") }
        } else if hint.contains("xc") || hint.contains("cross") {
            bikes = bikes.filter { $0.category == "XC / Cross-Country" || $0.suspension == "Hardtail" }
        } else {
            bikes = bikes.filter { $0.category == "Trail" || $0.category == "eBike" }
        }
        return bikes.sorted { ($0.bestPrice ?? .greatestFiniteMagnitude) < ($1.bestPrice ?? .greatestFiniteMagnitude) }
    }

    private func searchDestination() async {
        guard !destination.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = destination
        request.resultTypes = .address
        do {
            let response = try await MKLocalSearch(request: request).start()
            if let item = response.mapItems.first {
                let coordinate = item.placemark.coordinate
                position = .region(
                    MKCoordinateRegion(center: coordinate, span: MKCoordinateSpan(latitudeDelta: 0.22, longitudeDelta: 0.22))
                )
                searchStatus = "Destination found: \(item.name ?? destination)"
                inferRegionHint(from: destination)
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
        request.region = MKCoordinateRegion(center: coordinate, span: MKCoordinateSpan(latitudeDelta: 0.15, longitudeDelta: 0.15))
        do {
            nearbyShops = try await MKLocalSearch(request: request).start().mapItems
        } catch {
            nearbyShops = []
        }
    }
}
