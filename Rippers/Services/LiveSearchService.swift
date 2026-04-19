import Foundation

// ---------------------------------------------------------------------------
// LiveSearchService
// Calls the Vercel serverless function (api/search.js) with the user's
// current search criteria and returns a fresh [Bike] array from the web.
//
// Deploy the Vercel function first, then update `baseURL` with the real URL.
// ---------------------------------------------------------------------------

@MainActor
final class LiveSearchService {
    static let shared = LiveSearchService()
    private init() {}

    // Set this to your Vercel deployment URL after running `vercel deploy`.
    // Example: "https://rippers-abc123.vercel.app/api/search"
    static let baseURL = "https://rippers-pied.vercel.app/api/search"

    func search(criteria: LiveSearchCriteria) async throws -> LiveSearchResult {
        var components = URLComponents(string: Self.baseURL)!

        var items: [URLQueryItem] = [
            URLQueryItem(name: "country", value: "AU")
        ]

        if let category = criteria.category, category != "Any" {
            items.append(URLQueryItem(name: "category", value: category))
        }
        if let budget = criteria.budget {
            items.append(URLQueryItem(name: "budget", value: String(Int(budget))))
        }
        if let wheel = criteria.wheel, wheel != "Any" {
            items.append(URLQueryItem(name: "wheel", value: wheel))
        }
        if let style = criteria.style, !style.isEmpty {
            items.append(URLQueryItem(name: "style", value: style))
        }
        if let travel = criteria.travel, !travel.isEmpty {
            items.append(URLQueryItem(name: "travel", value: travel))
        }
        if !criteria.brands.isEmpty {
            items.append(URLQueryItem(name: "brands", value: criteria.brands.joined(separator: ",")))
        }
        if criteria.ebike {
            items.append(URLQueryItem(name: "ebike", value: "true"))
        }

        components.queryItems = items

        guard let url = components.url else {
            throw LiveSearchError.badURL
        }

        let (data, response) = try await URLSession.shared.data(from: url)

        guard let http = response as? HTTPURLResponse else {
            throw LiveSearchError.notHTTP
        }
        guard http.statusCode == 200 else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw LiveSearchError.httpError(http.statusCode, body)
        }

        let decoded = try JSONDecoder().decode(LiveSearchResponse.self, from: data)
        let bikes = decoded.bikes.map(\.bike)
            .map { normalizeRetailerKeys($0) }
            .map { enrich($0, from: BIKES) }

        return LiveSearchResult(
            bikes: bikes,
            count: decoded.count,
            queries: decoded.queries ?? [],
            timestamp: decoded.timestamp
        )
    }
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

struct LiveSearchCriteria {
    var category: String?
    var budget: Double?
    var wheel: String?
    var style: String?
    var travel: String?
    var brands: [String]
    var ebike: Bool

    static func from(_ state: FilterState) -> LiveSearchCriteria {
        // Pick first travel range if multiple selected (API takes a single value)
        let travel = state.activeTravelRanges.sorted().first

        // Prefer explicit filter values; fall back to profile hints when tailoring is on
        let effectiveCategory: String?
        if state.category != "Any" {
            effectiveCategory = state.category
        } else if state.tailorToProfile {
            effectiveCategory = state.profileCategoryHint
        } else {
            effectiveCategory = nil
        }

        let effectiveBudget = state.maxBudget ?? (state.tailorToProfile ? state.profileBudgetCap : nil)

        return LiveSearchCriteria(
            category: effectiveCategory,
            budget: effectiveBudget,
            wheel: state.wheel == "Any" ? nil : state.wheel,
            style: state.profileStyleHint,
            travel: travel,
            brands: Array(state.activeBrands).sorted(),
            ebike: state.activeEbikeFilter
        )
    }
}

struct LiveSearchResult {
    let bikes: [Bike]
    let count: Int
    let queries: [String]
    let timestamp: Double?
}

private struct LiveSearchResponse: Decodable {
    let bikes: [BikeRecord]
    let count: Int
    let queries: [String]?
    let timestamp: Double?
    let source: String?
}

// ---------------------------------------------------------------------------
// Retailer name → ID normalization
// Claude returns human-readable names ("99 Bikes", "Trek AU") but the app
// keys prices and inStock on retailer IDs ("99bikes", "trek"). Map them.
// ---------------------------------------------------------------------------

private func normalizeRetailerId(_ name: String) -> String {
    if RETAILERS.first(where: { $0.id == name }) != nil { return name }
    func clean(_ s: String) -> String {
        s.lowercased()
         .replacingOccurrences(of: " au", with: "")
         .replacingOccurrences(of: " australia", with: "")
         .filter { $0.isLetter || $0.isNumber }
    }
    let key = clean(name)
    return RETAILERS.first(where: { clean($0.name) == key || $0.id == key })?.id ?? name
}

private func normalizeRetailerKeys(_ bike: Bike) -> Bike {
    let prices = Dictionary(
        uniqueKeysWithValues: bike.prices.map { (normalizeRetailerId($0.key), $0.value) }
    )
    let inStock = bike.inStock.map { normalizeRetailerId($0) }
    return Bike(
        id: bike.id, brand: bike.brand, model: bike.model, year: bike.year,
        category: bike.category, wheel: bike.wheel, travel: bike.travel,
        suspension: bike.suspension, frame: bike.frame, drivetrain: bike.drivetrain,
        fork: bike.fork, shock: bike.shock, weight: bike.weight, brakes: bike.brakes,
        description: bike.description, sizes: bike.sizes,
        prices: prices, wasPrice: bike.wasPrice, inStock: inStock,
        sourceUrl: bike.sourceUrl, isEbike: bike.isEbike,
        motorBrand: bike.motorBrand, motor: bike.motor, battery: bike.battery,
        range: bike.range, ageRange: bike.ageRange, imageUrl: bike.imageUrl
    )
}

// ---------------------------------------------------------------------------
// Catalog enrichment
// When a live result matches a static catalog bike (brand + model),
// fill any blank fields with the known-accurate static data.
// Live prices, stock, imageUrl, and sourceUrl are always kept as-is.
// ---------------------------------------------------------------------------

private func enrich(_ live: Bike, from catalog: [Bike]) -> Bike {
    guard let known = catalog.first(where: {
        $0.brand.lowercased() == live.brand.lowercased() &&
        $0.model.lowercased() == live.model.lowercased()
    }) else { return live }

    func pick(_ liveVal: String, _ knownVal: String) -> String {
        liveVal.isEmpty ? knownVal : liveVal
    }
    func pickOpt(_ liveVal: String?, _ knownVal: String?) -> String? {
        (liveVal == nil || liveVal!.isEmpty) ? knownVal : liveVal
    }

    return Bike(
        id:          live.id,
        brand:       live.brand,
        model:       live.model,
        year:        live.year != 0 ? live.year : known.year,
        category:    pick(live.category,    known.category),
        wheel:       pick(live.wheel,       known.wheel),
        travel:      pick(live.travel,      known.travel),
        suspension:  pick(live.suspension,  known.suspension),
        frame:       pick(live.frame,       known.frame),
        drivetrain:  pick(live.drivetrain,  known.drivetrain),
        fork:        pick(live.fork,        known.fork),
        shock:       pick(live.shock,       known.shock),
        weight:      pick(live.weight,      known.weight),
        brakes:      pick(live.brakes,      known.brakes),
        description: pick(live.description, known.description),
        sizes:       live.sizes.isEmpty     ? known.sizes    : live.sizes,
        prices:      live.prices.isEmpty    ? known.prices   : live.prices,
        wasPrice:    live.wasPrice          ?? known.wasPrice,
        inStock:     live.inStock.isEmpty   ? known.inStock  : live.inStock,
        sourceUrl:   pick(live.sourceUrl,   known.sourceUrl),
        isEbike:     live.isEbike,
        motorBrand:  pickOpt(live.motorBrand, known.motorBrand),
        motor:       pickOpt(live.motor,      known.motor),
        battery:     pickOpt(live.battery,    known.battery),
        range:       pickOpt(live.range,      known.range),
        ageRange:    pickOpt(live.ageRange,   known.ageRange),
        imageUrl:    live.imageUrl ?? known.imageUrl
    )
}

enum LiveSearchError: LocalizedError {
    case badURL
    case notHTTP
    case httpError(Int, String)

    var errorDescription: String? {
        switch self {
        case .badURL:
            return "Invalid search URL."
        case .notHTTP:
            return "Unexpected response from search service."
        case .httpError(let code, _):
            return "Search service error (\(code))."
        }
    }
}
