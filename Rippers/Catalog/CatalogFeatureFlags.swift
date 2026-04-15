import Foundation

public struct CatalogFeatureFlags: Sendable {
    public var useLiveCatalog: Bool
    public var useBrandedUIV2: Bool

    public init(useLiveCatalog: Bool, useBrandedUIV2: Bool) {
        self.useLiveCatalog = useLiveCatalog
        self.useBrandedUIV2 = useBrandedUIV2
    }

    public static let current = CatalogFeatureFlags(
        useLiveCatalog: true,
        useBrandedUIV2: false
    )
}
