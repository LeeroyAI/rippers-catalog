import XCTest
@testable import RippersCore

final class BikeFilterEngineTests: XCTestCase {
    func testTextQueryReturnsExpectedBikeIDs() {
        var filters = FilterState()
        filters.searchText = "turbo levo"

        let ids = BikeFilterEngine.apply(bikes: BIKES, filters: filters).map(\.id)
        XCTAssertTrue(ids.contains(26))
        XCTAssertTrue(ids.contains(27))
    }

    func testCategoryAndBrandFiltersIntersect() {
        var filters = FilterState()
        filters.category = "Trail"
        filters.activeBrands = ["Giant"]

        let ids = BikeFilterEngine.apply(bikes: BIKES, filters: filters).map(\.id)
        XCTAssertFalse(ids.isEmpty)
        let matched = BIKES.filter { ids.contains($0.id) }
        XCTAssertTrue(matched.allSatisfy { $0.brand == "Giant" && $0.category == "Trail" })
    }

    func testBudgetFilterUsesBestPrice() {
        var filters = FilterState()
        filters.maxBudget = 5000

        let filtered = BikeFilterEngine.apply(bikes: BIKES, filters: filters)
        XCTAssertFalse(filtered.isEmpty)
        XCTAssertTrue(filtered.allSatisfy { ($0.displayBestPrice ?? .greatestFiniteMagnitude) <= 5000 })
    }

    func testWheelFilterAndActiveWheelChips() {
        var filters = FilterState()
        filters.wheel = "29\""
        filters.activeWheels = ["29\""]

        let filtered = BikeFilterEngine.apply(bikes: BIKES, filters: filters)
        XCTAssertFalse(filtered.isEmpty)
        XCTAssertTrue(filtered.allSatisfy { $0.wheel == "29\"" })
    }

    func testBiggestSavingsSortOrdersDescending() {
        var filters = FilterState()
        filters.sort = .biggestSavings

        let filtered = BikeFilterEngine.apply(bikes: BIKES, filters: filters)
        let savings = filtered.compactMap(\.savings)
        XCTAssertFalse(savings.isEmpty)
        XCTAssertEqual(savings, savings.sorted(by: >))
    }

    func testProfileRankSortsHigherMatchFirst() {
        var filters = FilterState()
        filters.tailorToProfile = true
        filters.profileCategoryHint = "Trail"
        filters.profileStyleHint = "Trail"
        filters.profileBudgetCap = 5000

        let ranked = BikeFilterEngine.rank(bikes: BIKES, filters: filters)
        XCTAssertFalse(ranked.isEmpty)
        XCTAssertTrue(ranked[0].score >= ranked.last?.score ?? 0)
    }
}
