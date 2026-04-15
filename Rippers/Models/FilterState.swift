import Foundation

public enum BikeSortOption: String, CaseIterable, Sendable {
    case priceLowToHigh
    case priceHighToLow
    case brandAZ
    case biggestSavings
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
    public var sort: BikeSortOption = .priceLowToHigh

    public init() {}
}
