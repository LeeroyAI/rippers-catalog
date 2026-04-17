import Foundation

public struct Bike: Identifiable, Hashable, Sendable {
    public let id: Int
    public let brand: String
    public let model: String
    public let year: Int
    public let category: String
    public let wheel: String
    public let travel: String
    public let suspension: String
    public let frame: String
    public let drivetrain: String
    public let fork: String
    public let shock: String
    public let weight: String
    public let brakes: String
    public let description: String
    public let sizes: [String]
    public let prices: [String: Double]
    public let wasPrice: Double?
    public let inStock: [String]
    public let sourceUrl: String
    public let isEbike: Bool
    public let motorBrand: String?
    public let motor: String?
    public let battery: String?
    public let range: String?
    public let ageRange: String?
    public let imageUrl: String?

    public init(
        id: Int,
        brand: String,
        model: String,
        year: Int,
        category: String,
        wheel: String,
        travel: String,
        suspension: String,
        frame: String,
        drivetrain: String,
        fork: String,
        shock: String,
        weight: String,
        brakes: String,
        description: String,
        sizes: [String],
        prices: [String: Double],
        wasPrice: Double?,
        inStock: [String],
        sourceUrl: String,
        isEbike: Bool,
        motorBrand: String? = nil,
        motor: String? = nil,
        battery: String? = nil,
        range: String? = nil,
        ageRange: String? = nil,
        imageUrl: String? = nil
    ) {
        self.id = id
        self.brand = brand
        self.model = model
        self.year = year
        self.category = category
        self.wheel = wheel
        self.travel = travel
        self.suspension = suspension
        self.frame = frame
        self.drivetrain = drivetrain
        self.fork = fork
        self.shock = shock
        self.weight = weight
        self.brakes = brakes
        self.description = description
        self.sizes = sizes
        self.prices = prices
        self.wasPrice = wasPrice
        self.inStock = inStock
        self.sourceUrl = sourceUrl
        self.isEbike = isEbike
        self.motorBrand = motorBrand
        self.motor = motor
        self.battery = battery
        self.range = range
        self.ageRange = ageRange
        self.imageUrl = imageUrl
    }

    /// Fast local fallback only. Dynamic resolution happens via `BikeImageResolver`.
    public var effectiveImageURL: URL? {
        if let s = imageUrl,
           !s.isEmpty,
           let u = URL(string: s),
           Self.isLikelyProductImageURL(u) {
            return u
        }
        if let s = BIKE_IMAGES[id],
           let u = URL(string: s),
           Self.isLikelyProductImageURL(u) {
            return u
        }
        return nil
    }

    public var imageCacheKey: String {
        "\(brand.lowercased())|\(model.lowercased())|\(year)"
    }

    /// Lowest currently in-stock price across known retailers.
    public var bestPrice: Double? {
        prices
            .filter { inStock.contains($0.key) }
            .map(\.value)
            .min()
    }

    public var bestRetailerId: String? {
        prices
            .filter { inStock.contains($0.key) }
            .min(by: { $0.value < $1.value })?
            .key
    }

    public var savings: Double? {
        guard let was = wasPrice, let best = bestPrice else { return nil }
        return was - best
    }

    public var searchBlob: String {
        [
            brand, model, category, wheel, travel, suspension,
            frame, drivetrain, fork, shock, brakes, description
        ].joined(separator: " ").lowercased()
    }

    // Extracts the first travel value in millimeters, handling inputs like
    // "160-180mm", "160–180mm", or "170mm front / 160mm rear".
    public var travelMM: Int {
        let scalars = travel.unicodeScalars
        var digits = ""
        for scalar in scalars {
            if CharacterSet.decimalDigits.contains(scalar) {
                digits.append(String(scalar))
            } else if !digits.isEmpty {
                break
            }
        }
        return Int(digits) ?? 0
    }

    public static func isLikelyProductImageURL(_ url: URL) -> Bool {
        let host = (url.host ?? "").lowercased()
        let full = url.absoluteString.lowercased()

        // Reject obviously non-product imagery unless strong product hints exist.
        let negativeTokens = [
            "action", "lifestyle", "riding", "rider", "trail", "landscape",
            "background", "scenic", "jump", "park", "carousel", "banner"
        ]
        let positiveTokens = [
            "side", "profile", "primary", "product", "bike", "studio", "front"
        ]
        let hasNegative = negativeTokens.contains { full.contains($0) }
        let hasPositive = positiveTokens.contains { full.contains($0) }

        if hasNegative && !hasPositive {
            return false
        }

        // Common e-commerce/product CDN hosts used by bike brands and retailers.
        let trustedHosts = [
            "sefiles.net",
            "shopify.com",
            "santacruzbicycles.com",
            "giant-bicycles.com",
            "yt-industries.com",
            "canyon.com",
            "commencal",
            "bikes.com",
            "forbiddenbike.com",
            "vitalmtb.com",
            "bigcommerce.com",
            "trek.scene7.com",
            "specialized.com",
            "norco.com",
            "merida-cdn.m-c-g.net"
        ]
        if trustedHosts.contains(where: { host.contains($0) }) {
            return true
        }

        // For unknown hosts, require explicit product hints.
        return hasPositive
    }
}

actor BikeImageResolver {
    static let shared = BikeImageResolver()

    private let cacheKey = "rippers.dynamicBikeImageCache.v1"
    private var memoryCache: [String: URL] = [:]
    private var inFlight: [String: Task<URL?, Never>] = [:]

    func resolvedImageURL(for bike: Bike) async -> URL? {
        if let cached = memoryCache[bike.imageCacheKey] {
            return cached
        }
        if let persisted = persistedImageURL(for: bike.imageCacheKey) {
            memoryCache[bike.imageCacheKey] = persisted
            return persisted
        }
        if let task = inFlight[bike.imageCacheKey] {
            return await task.value
        }

        let task = Task<URL?, Never> {
            let resolved = await resolveFreshImageURL(for: bike)
            return resolved
        }
        inFlight[bike.imageCacheKey] = task
        let resolved = await task.value
        inFlight[bike.imageCacheKey] = nil

        if let resolved {
            memoryCache[bike.imageCacheKey] = resolved
            persistImageURL(resolved, for: bike.imageCacheKey)
        }
        return resolved
    }

    private func resolveFreshImageURL(for bike: Bike) async -> URL? {
        if let sourceURL = URL(string: bike.sourceUrl),
           let sourceCandidate = await fetchProductImageFromSourcePage(sourceURL),
           Bike.isLikelyProductImageURL(sourceCandidate) {
            return sourceCandidate
        }

        if let direct = bike.effectiveImageURL {
            return direct
        }

        return nil
    }

    private func fetchProductImageFromSourcePage(_ sourceURL: URL) async -> URL? {
        var request = URLRequest(url: sourceURL)
        request.timeoutInterval = 12
        request.setValue("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148", forHTTPHeaderField: "User-Agent")

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                return nil
            }

            if let mime = http.value(forHTTPHeaderField: "Content-Type")?.lowercased(),
               mime.contains("image") {
                return sourceURL
            }

            guard let html = String(data: data, encoding: .utf8), !html.isEmpty else {
                return nil
            }

            let candidates = extractImageCandidates(fromHTML: html, baseURL: sourceURL)
            return candidates.first(where: { Bike.isLikelyProductImageURL($0) })
        } catch {
            return nil
        }
    }

    private func extractImageCandidates(fromHTML html: String, baseURL: URL) -> [URL] {
        var urls: [URL] = []
        let patterns = [
            #"<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']"#,
            #"<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']"#,
            #""image"\s*:\s*"([^"]+)""#
        ]

        for pattern in patterns {
            guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { continue }
            let range = NSRange(location: 0, length: html.utf16.count)
            regex.enumerateMatches(in: html, options: [], range: range) { match, _, _ in
                guard let match, match.numberOfRanges > 1,
                      let captureRange = Range(match.range(at: 1), in: html) else { return }
                let candidate = String(html[captureRange]).replacingOccurrences(of: "\\/", with: "/")
                if let url = URL(string: candidate, relativeTo: baseURL)?.absoluteURL, url.scheme?.hasPrefix("http") == true {
                    urls.append(url)
                }
            }
        }

        var seen: Set<String> = []
        return urls.filter {
            let key = $0.absoluteString
            guard !seen.contains(key) else { return false }
            seen.insert(key)
            return true
        }
    }

    private func persistedImageURL(for key: String) -> URL? {
        guard let dict = UserDefaults.standard.dictionary(forKey: cacheKey) as? [String: String],
              let raw = dict[key],
              let url = URL(string: raw) else {
            return nil
        }
        return url
    }

    private func persistImageURL(_ url: URL, for key: String) {
        var dict = (UserDefaults.standard.dictionary(forKey: cacheKey) as? [String: String]) ?? [:]
        dict[key] = url.absoluteString
        UserDefaults.standard.set(dict, forKey: cacheKey)
    }
}

public enum RidingDisciplineKind: Sendable {
    case trail
    case gravity
    case crossCountry
    case jump
    case other

    public static func from(_ raw: String?) -> RidingDisciplineKind {
        let style = raw?.lowercased() ?? ""
        if style.contains("cross") || style.contains("xc") {
            return .crossCountry
        }
        if style.contains("dirt jump") || style.contains("pump") || style.contains("slopestyle") {
            return .jump
        }
        if style.contains("gravity") || style.contains("enduro") || style.contains("downhill") || style.contains("freeride") {
            return .gravity
        }
        if style.contains("trail") || style.contains("all-mountain") || style.contains("all mountain") {
            return .trail
        }
        return .other
    }
}

public struct BikeRecord: Codable, Sendable {
    public let id: Int
    public let brand: String
    public let model: String
    public let year: Int
    public let category: String
    public let wheel: String
    public let travel: String
    public let suspension: String
    public let frame: String
    public let drivetrain: String
    public let fork: String
    public let shock: String
    public let weight: String
    public let brakes: String
    public let description: String
    public let sizes: [String]
    public let prices: [String: Double]
    public let wasPrice: Double?
    public let inStock: [String]
    public let sourceUrl: String
    public let isEbike: Bool
    public let motorBrand: String?
    public let motor: String?
    public let battery: String?
    public let range: String?
    public let ageRange: String?
    public let imageUrl: String?

    public init(_ bike: Bike) {
        id = bike.id
        brand = bike.brand
        model = bike.model
        year = bike.year
        category = bike.category
        wheel = bike.wheel
        travel = bike.travel
        suspension = bike.suspension
        frame = bike.frame
        drivetrain = bike.drivetrain
        fork = bike.fork
        shock = bike.shock
        weight = bike.weight
        brakes = bike.brakes
        description = bike.description
        sizes = bike.sizes
        prices = bike.prices
        wasPrice = bike.wasPrice
        inStock = bike.inStock
        sourceUrl = bike.sourceUrl
        isEbike = bike.isEbike
        motorBrand = bike.motorBrand
        motor = bike.motor
        battery = bike.battery
        range = bike.range
        ageRange = bike.ageRange
        imageUrl = bike.imageUrl
    }

    public var bike: Bike {
        Bike(
            id: id,
            brand: brand,
            model: model,
            year: year,
            category: category,
            wheel: wheel,
            travel: travel,
            suspension: suspension,
            frame: frame,
            drivetrain: drivetrain,
            fork: fork,
            shock: shock,
            weight: weight,
            brakes: brakes,
            description: description,
            sizes: sizes,
            prices: prices,
            wasPrice: wasPrice,
            inStock: inStock,
            sourceUrl: sourceUrl,
            isEbike: isEbike,
            motorBrand: motorBrand,
            motor: motor,
            battery: battery,
            range: range,
            ageRange: ageRange,
            imageUrl: imageUrl
        )
    }
}
