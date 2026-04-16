import Foundation

public enum BikeSortOption: String, CaseIterable, Sendable {
    case bestMatch
    case priceLowToHigh
    case priceHighToLow
    case brandAZ
    case biggestSavings

    public var label: String {
        switch self {
        case .bestMatch:      return "Best Match"
        case .priceLowToHigh: return "Price: Low to High"
        case .priceHighToLow: return "Price: High to Low"
        case .brandAZ:        return "Brand A–Z"
        case .biggestSavings: return "Biggest Savings"
        }
    }
}

public struct FilterState: Sendable {
    public var searchText: String = ""
    public var category: String = "Any"
    public var wheel: String = "Any"
    public var maxBudget: Double?
    public var activeBrands: Set<String> = []
    public var activeEbikeFilter: Bool = false
    public var activeEbikeBrandFilters: Set<String> = []
    public var activeTravelRanges: Set<String> = []
    public var activeWheels: Set<String> = []
    public var tailorToProfile: Bool = false
    public var profileCategoryHint: String?
    public var profileStyleHint: String?
    public var profileHeightCm: Int?
    public var profileBudgetCap: Double?
    public var sort: BikeSortOption = .bestMatch

    public init() {}
}
