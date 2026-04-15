import Foundation

public enum CatalogValidator {
    public static func validate(sourceID: String, bikes: [Bike]) -> [CatalogAuditRecord] {
        var audits: [CatalogAuditRecord] = []
        let retailerIDs = Set(RETAILERS.map(\.id))
        var seenIDs: Set<Int> = []

        for bike in bikes {
            if !seenIDs.insert(bike.id).inserted {
                audits.append(.init(
                    sourceID: sourceID,
                    bikeID: bike.id,
                    severity: .critical,
                    message: "Duplicate bike id detected."
                ))
            }

            if bike.brand.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || bike.model.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                audits.append(.init(
                    sourceID: sourceID,
                    bikeID: bike.id,
                    severity: .critical,
                    message: "Bike brand/model missing."
                ))
            }

            if !bike.sourceUrl.hasPrefix("https://") {
                audits.append(.init(
                    sourceID: sourceID,
                    bikeID: bike.id,
                    severity: .warning,
                    message: "Bike source URL is not HTTPS."
                ))
            }

            for (retailerID, price) in bike.prices {
                if !retailerIDs.contains(retailerID) {
                    audits.append(.init(
                        sourceID: sourceID,
                        bikeID: bike.id,
                        severity: .critical,
                        message: "Unknown retailer id: \(retailerID)"
                    ))
                }
                if price < 0 {
                    audits.append(.init(
                        sourceID: sourceID,
                        bikeID: bike.id,
                        severity: .critical,
                        message: "Negative price for retailer \(retailerID)."
                    ))
                }
            }

            let pricedRetailers = Set(bike.prices.keys)
            for inStockRetailer in bike.inStock where !pricedRetailers.contains(inStockRetailer) {
                audits.append(.init(
                    sourceID: sourceID,
                    bikeID: bike.id,
                    severity: .critical,
                    message: "inStock retailer \(inStockRetailer) missing in prices."
                ))
            }
        }

        return audits
    }
}
