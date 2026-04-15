import SwiftUI

enum BrandSystem {
    static let enabled = CatalogFeatureFlags.current.useBrandedUIV2
}

enum BrandColor {
    static let background = Color(hex: "#0C111D")
    static let surface = Color(hex: "#151D2E")
    static let surfaceElevated = Color(hex: "#1C2740")
    static let border = Color(hex: "#2B3652")
    static let primary = Color(hex: "#FF6A1A")
    static let primaryPressed = Color(hex: "#E25308")
    static let success = Color(hex: "#34D399")
    static let warning = Color(hex: "#F59E0B")
    static let text = Color(hex: "#F8FAFC")
    static let textMuted = Color(hex: "#9CA3AF")
}

enum BrandSpacing {
    static let xs: CGFloat = 6
    static let sm: CGFloat = 10
    static let md: CGFloat = 14
    static let lg: CGFloat = 20
}

enum BrandRadius {
    static let sm: CGFloat = 10
    static let md: CGFloat = 14
    static let lg: CGFloat = 18
}
