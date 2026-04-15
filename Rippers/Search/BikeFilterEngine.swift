import Foundation

public struct MatchFactor: Identifiable, Sendable {
    public let id: String
    public let title: String
    public let points: Int
    public let note: String

    public init(id: String, title: String, points: Int, note: String) {
        self.id = id
        self.title = title
        self.points = points
        self.note = note
    }
}

public enum BikeFilterEngine {
    private static func travelMM(_ bike: Bike) -> Int {
        bike.travelMM
    }

    private static func isSuitable(_ bike: Bike, for style: RidingDisciplineKind) -> Bool {
        let travel = travelMM(bike)
        let isHardtail = bike.suspension == "Hardtail"
        switch style {
        case .gravity:
            // Gravity disciplines should never return hardtails.
            return !isHardtail && (bike.category == "Enduro" || travel >= 160)
        case .trail:
            return bike.category == "Trail" || bike.category == "eBike" || (isHardtail && travel <= 140)
        case .crossCountry:
            return bike.category == "XC / Cross-Country" || (isHardtail && travel <= 130)
        case .jump:
            return isHardtail
        case .other:
            return true
        }
    }

    public static func apply(
        bikes: [Bike],
        filters: FilterState
    ) -> [Bike] {
        bikes
            .filter { matchesText($0, filters: filters) }
            .filter { matchesCategory($0, filters: filters) }
            .filter { matchesWheel($0, filters: filters) }
            .filter { matchesBudget($0, filters: filters) }
            .filter { matchesEbikeMode($0, filters: filters) }
            .filter { matchesBrands($0, filters: filters) }
            .filter { matchesTravel($0, filters: filters) }
            .filter { matchesProfileHints($0, filters: filters) }
            .sorted(by: sortComparator(for: filters.sort))
    }

    static func matchesText(_ bike: Bike, filters: FilterState) -> Bool {
        let query = filters.searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !query.isEmpty else { return true }
        return bike.searchBlob.contains(query)
    }

    static func matchesCategory(_ bike: Bike, filters: FilterState) -> Bool {
        if filters.category == "Any" { return true }
        if filters.category == "Hardtail" { return bike.suspension == "Hardtail" }
        return bike.category == filters.category
    }

    static func matchesWheel(_ bike: Bike, filters: FilterState) -> Bool {
        if filters.wheel != "Any" && bike.wheel != filters.wheel { return false }
        if !filters.activeWheels.isEmpty && !filters.activeWheels.contains(bike.wheel) { return false }
        return true
    }

    static func matchesBudget(_ bike: Bike, filters: FilterState) -> Bool {
        guard let maxBudget = filters.maxBudget else { return true }
        guard let bestPrice = bike.bestPrice else { return false }
        return bestPrice <= maxBudget
    }

    static func matchesEbikeMode(_ bike: Bike, filters: FilterState) -> Bool {
        if !filters.activeEbikeBrandFilters.isEmpty {
            return bike.isEbike && filters.activeEbikeBrandFilters.contains(bike.brand)
        }
        if filters.activeEbikeFilter {
            return bike.isEbike
        }
        return true
    }

    static func matchesBrands(_ bike: Bike, filters: FilterState) -> Bool {
        if !filters.activeEbikeBrandFilters.isEmpty { return true }
        return filters.activeBrands.isEmpty || filters.activeBrands.contains(bike.brand)
    }

    static func matchesTravel(_ bike: Bike, filters: FilterState) -> Bool {
        guard !filters.activeTravelRanges.isEmpty else { return true }

        let isHardtail = bike.suspension == "Hardtail"
        let travelValue = bike.travelMM

        return filters.activeTravelRanges.contains { filter in
            switch filter {
            case "Hardtail":
                return isHardtail
            case "100-120mm":
                return !isHardtail && (100...120).contains(travelValue)
            case "130-140mm":
                return !isHardtail && (130...140).contains(travelValue)
            case "150-160mm":
                return !isHardtail && (150...160).contains(travelValue)
            case "160-180mm":
                return !isHardtail && travelValue >= 160
            default:
                return bike.travel == filter
            }
        }
    }

    static func matchesProfileHints(_ bike: Bike, filters: FilterState) -> Bool {
        guard filters.tailorToProfile else { return true }

        if let riderHeight = filters.profileHeightCm, riderHeight >= 165 {
            if bike.wheel == "24\"" { return false }
            if let ageRange = bike.ageRange?.lowercased(),
               ageRange.contains("kid") || ageRange.contains("youth") || ageRange.contains("child") {
                return false
            }
        }

        if let category = filters.profileCategoryHint, category != "Any", bike.category != category {
            return false
        }

        let style = RidingDisciplineKind.from(filters.profileStyleHint)
        if style != .other && !isSuitable(bike, for: style) {
            return false
        }

        if let budgetCap = filters.profileBudgetCap, budgetCap > 0 {
            guard let best = bike.bestPrice, best <= budgetCap else { return false }
        }

        return true
    }

    static func sortComparator(for option: BikeSortOption) -> (Bike, Bike) -> Bool {
        switch option {
        case .priceLowToHigh:
            return { lhs, rhs in
                let l = lhs.bestPrice ?? .greatestFiniteMagnitude
                let r = rhs.bestPrice ?? .greatestFiniteMagnitude
                if l == r { return lhs.id < rhs.id }
                return l < r
            }
        case .priceHighToLow:
            return { lhs, rhs in
                let l = lhs.bestPrice ?? 0
                let r = rhs.bestPrice ?? 0
                if l == r { return lhs.id < rhs.id }
                return l > r
            }
        case .brandAZ:
            return { lhs, rhs in
                if lhs.brand == rhs.brand {
                    return lhs.model < rhs.model
                }
                return lhs.brand < rhs.brand
            }
        case .biggestSavings:
            return { lhs, rhs in
                let l = lhs.savings ?? 0
                let r = rhs.savings ?? 0
                if l == r { return lhs.id < rhs.id }
                return l > r
            }
        }
    }

    public static func rank(bikes: [Bike], filters: FilterState) -> [(bike: Bike, score: Int)] {
        bikes
            .map { bike in (bike: bike, score: matchScore(for: bike, filters: filters)) }
            .sorted {
                if $0.score == $1.score {
                    return ($0.bike.bestPrice ?? .greatestFiniteMagnitude) < ($1.bike.bestPrice ?? .greatestFiniteMagnitude)
                }
                return $0.score > $1.score
            }
    }

    public static func matchScore(for bike: Bike, filters: FilterState) -> Int {
        var score = 40

        if filters.tailorToProfile {
            if let category = filters.profileCategoryHint, category != "Any", bike.category == category {
                score += 20
            }

            switch RidingDisciplineKind.from(filters.profileStyleHint) {
                case .trail:
                    if isSuitable(bike, for: .trail) { score += 15 }
                case .gravity:
                    if isSuitable(bike, for: .gravity) { score += 18 }
                case .crossCountry:
                    if isSuitable(bike, for: .crossCountry) { score += 15 }
                case .jump:
                    if isSuitable(bike, for: .jump) { score += 12 }
                default:
                    break
                }

            if let cap = filters.profileBudgetCap, cap > 0, let price = bike.bestPrice {
                if price <= cap {
                    let headroom = max(0, cap - price)
                    score += min(20, Int(headroom / 400))
                } else {
                    score -= 25
                }
            }
        }

        if let maxBudget = filters.maxBudget, let best = bike.bestPrice {
            if best <= maxBudget { score += 8 } else { score -= 8 }
        }

        if !filters.activeTravelRanges.isEmpty {
            score += filters.activeTravelRanges.contains { range in bike.travel.contains(range.replacingOccurrences(of: "-180mm", with: "")) } ? 6 : 0
        }

        return max(0, min(100, score))
    }

    public static func explainScore(for bike: Bike, filters: FilterState) -> [String] {
        var reasons: [String] = []

        if filters.tailorToProfile {
            reasons.append("Tailored to active rider profile")

            if let category = filters.profileCategoryHint, category != "Any" {
                if bike.category == category {
                    reasons.append("Matches preferred category: \(category)")
                } else {
                    reasons.append("Category differs from preference (\(category))")
                }
            }

            switch RidingDisciplineKind.from(filters.profileStyleHint) {
                case .trail:
                    reasons.append(isSuitable(bike, for: .trail) ? "Trail style aligned" : "Trail style mismatch")
                case .gravity:
                    reasons.append(isSuitable(bike, for: .gravity) ? "Gravity style aligned" : "Gravity style mismatch")
                case .crossCountry:
                    reasons.append(isSuitable(bike, for: .crossCountry) ? "XC style aligned" : "XC style mismatch")
                case .jump:
                    reasons.append(isSuitable(bike, for: .jump) ? "Jump style aligned" : "Jump style mismatch")
                default:
                    break
                }

            if let cap = filters.profileBudgetCap, cap > 0, let price = bike.bestPrice {
                if price <= cap {
                    reasons.append("Within profile budget cap")
                } else {
                    reasons.append("Above profile budget cap")
                }
            }
        }

        if let best = bike.bestPrice {
            reasons.append("Best available price: \(Int(best)) AUD")
        }
        if let savings = bike.savings, savings > 0 {
            reasons.append("Current savings: \(Int(savings)) AUD")
        }

        return Array(reasons.prefix(4))
    }

    public static func scoreBreakdown(for bike: Bike, filters: FilterState) -> [MatchFactor] {
        var factors: [MatchFactor] = []
        factors.append(.init(id: "base", title: "Base fit", points: 40, note: "Starting relevance score"))

        if filters.tailorToProfile {
            if let category = filters.profileCategoryHint, category != "Any" {
                let points = bike.category == category ? 20 : 0
                factors.append(.init(id: "profile-category", title: "Preferred category", points: points, note: bike.category == category ? "Category matches \(category)" : "No direct category match"))
            }

            if filters.profileStyleHint != nil {
                var points = 0
                var note = "Style partially aligned"
                switch RidingDisciplineKind.from(filters.profileStyleHint) {
                case .trail:
                    if isSuitable(bike, for: .trail) { points = 15; note = "Trail style aligned" }
                case .gravity:
                    if isSuitable(bike, for: .gravity) { points = 18; note = "Gravity style aligned" }
                case .crossCountry:
                    if isSuitable(bike, for: .crossCountry) { points = 15; note = "XC style aligned" }
                case .jump:
                    if isSuitable(bike, for: .jump) { points = 12; note = "Jump style aligned" }
                default:
                    break
                }
                factors.append(.init(id: "profile-style", title: "Riding style", points: points, note: note))
            }

            if let riderHeight = filters.profileHeightCm, riderHeight >= 165 {
                let adultFit = bike.wheel != "24\"" && !(bike.ageRange?.lowercased().contains("kid") ?? false)
                factors.append(.init(id: "profile-rider-size", title: "Rider size fit", points: adultFit ? 8 : -20, note: adultFit ? "Bike size aligns with adult rider height" : "Likely youth/kids sizing for this rider"))
            }

            if let cap = filters.profileBudgetCap, cap > 0, let price = bike.bestPrice {
                if price <= cap {
                    let headroom = max(0, cap - price)
                    let points = min(20, Int(headroom / 400))
                    factors.append(.init(id: "profile-budget", title: "Profile budget", points: points, note: "Within cap, \(Int(headroom)) AUD headroom"))
                } else {
                    factors.append(.init(id: "profile-budget", title: "Profile budget", points: -25, note: "Above budget cap"))
                }
            }
        }

        if let maxBudget = filters.maxBudget, let best = bike.bestPrice {
            factors.append(.init(id: "active-budget", title: "Active budget filter", points: best <= maxBudget ? 8 : -8, note: best <= maxBudget ? "Within current budget filter" : "Outside current budget filter"))
        }

        if !filters.activeTravelRanges.isEmpty {
            let matched = filters.activeTravelRanges.contains { range in bike.travel.contains(range.replacingOccurrences(of: "-180mm", with: "")) }
            factors.append(.init(id: "travel", title: "Travel preference", points: matched ? 6 : 0, note: matched ? "Travel preference aligned" : "No travel bonus"))
        }

        return factors
    }
}
