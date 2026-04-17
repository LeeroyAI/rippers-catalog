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

    /// The best available image URL: static catalog map first, then live search URL.
    public var effectiveImageURL: URL? {
        if let s = BIKE_IMAGES[id], let u = URL(string: s) { return u }
        if let s = imageUrl, !s.isEmpty, let u = URL(string: s) { return u }
        return nil
    }

    public var bestPrice: Double? { prices.values.min() }

    public var bestRetailerId: String? {
        prices.min(by: { $0.value < $1.value })?.key
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
