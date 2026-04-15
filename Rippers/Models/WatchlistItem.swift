import Foundation
import SwiftData

@Model
public final class WatchlistItem {
    public var bikeId: Int
    public var addedAt: Date
    public var targetPrice: Double
    public var priceHistory: [Double]
    public var isFavourite: Bool

    public init(
        bikeId: Int,
        targetPrice: Double,
        priceHistory: [Double] = [],
        isFavourite: Bool = false
    ) {
        self.bikeId = bikeId
        self.addedAt = Date()
        self.targetPrice = targetPrice
        self.priceHistory = priceHistory
        self.isFavourite = isFavourite
    }
}
