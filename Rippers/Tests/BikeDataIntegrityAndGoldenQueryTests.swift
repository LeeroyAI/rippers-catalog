import XCTest
@testable import RippersCore

final class BikeDataIntegrityAndGoldenQueryTests: XCTestCase {
    func testCatalogHasExpectedBikeCount() {
        XCTAssertEqual(BIKES.count, 48, "Bike count should match frozen dashboard snapshot.")
    }

    func testBikeIDsAreUnique() {
        let ids = BIKES.map(\.id)
        XCTAssertEqual(Set(ids).count, ids.count, "Bike IDs must be unique.")
    }

    func testRetailerReferencesAreValid() {
        let retailerIDs = Set(RETAILERS.map(\.id))
        for bike in BIKES {
            for retailerID in bike.prices.keys {
                XCTAssertTrue(retailerIDs.contains(retailerID), "Unknown retailer \(retailerID) for bike \(bike.id)")
            }
        }
    }

    func testStockIsSubsetOfPriceRetailers() {
        for bike in BIKES {
            let pricedRetailers = Set(bike.prices.keys)
            for retailerID in bike.inStock {
                XCTAssertTrue(pricedRetailers.contains(retailerID), "In-stock retailer \(retailerID) missing from prices for bike \(bike.id)")
            }
        }
    }

    func testSourceURLsAreHTTPS() {
        for bike in BIKES {
            XCTAssertTrue(bike.sourceUrl.hasPrefix("https://"), "Bike \(bike.id) has non-HTTPS source URL.")
        }
    }

    func testEbikeFieldsAreConsistent() {
        for bike in BIKES {
            if bike.isEbike {
                XCTAssertNotNil(bike.motorBrand, "eBike \(bike.id) missing motorBrand")
                XCTAssertNotNil(bike.motor, "eBike \(bike.id) missing motor")
                XCTAssertNotNil(bike.battery, "eBike \(bike.id) missing battery")
                XCTAssertNotNil(bike.range, "eBike \(bike.id) missing range")
            } else {
                XCTAssertNil(bike.motorBrand, "Non-eBike \(bike.id) should not have motorBrand")
                XCTAssertNil(bike.motor, "Non-eBike \(bike.id) should not have motor")
                XCTAssertNil(bike.battery, "Non-eBike \(bike.id) should not have battery")
                XCTAssertNil(bike.range, "Non-eBike \(bike.id) should not have range")
            }
        }
    }

    func testGoldenQueryTurboLevoSearch() {
        var filters = FilterState()
        filters.searchText = "turbo levo"

        let ids = BikeFilterEngine.apply(bikes: BIKES, filters: filters).map(\.id)
        XCTAssertEqual(ids, [26, 27])
    }

    func testGoldenQueryTrailNorcoBrand() {
        var filters = FilterState()
        filters.category = "Trail"
        filters.activeBrands = ["Norco"]

        let ids = BikeFilterEngine.apply(bikes: BIKES, filters: filters).map(\.id)
        XCTAssertEqual(ids, [14, 13, 39, 15, 3])
    }

    func testGoldenQueryAMFLOWEbikeBrand() {
        var filters = FilterState()
        filters.activeEbikeBrandFilters = ["AMFLOW"]

        let ids = BikeFilterEngine.apply(bikes: BIKES, filters: filters).map(\.id)
        XCTAssertEqual(ids, [37, 38, 16, 35, 24, 36])
    }

    func testGoldenQueryTrail24InchResults() {
        var filters = FilterState()
        filters.category = "Trail"
        filters.wheel = "24\""

        let ids = BikeFilterEngine.apply(bikes: BIKES, filters: filters).map(\.id)
        XCTAssertEqual(ids, [14, 48, 42, 13, 44, 39, 40, 47, 41, 45, 15, 46, 43])
    }

    func testGoldenQueryTrailBudgetAt1000() {
        var filters = FilterState()
        filters.category = "Trail"
        filters.maxBudget = 1000

        let ids = BikeFilterEngine.apply(bikes: BIKES, filters: filters).map(\.id)
        XCTAssertEqual(ids, [14, 48, 42, 13, 44, 39, 40, 47, 41])
    }

    func testGoldenQueryHardtailTravelFilter() {
        var filters = FilterState()
        filters.activeTravelRanges = ["Hardtail"]

        let ids = BikeFilterEngine.apply(bikes: BIKES, filters: filters).map(\.id)
        XCTAssertEqual(ids, [14, 48, 42, 13, 44, 39, 40, 47, 41, 45, 10])
    }
}
