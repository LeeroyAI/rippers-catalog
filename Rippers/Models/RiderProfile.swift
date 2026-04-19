import Foundation
import SwiftData

@Model
public final class RiderProfile {
    public var id: UUID
    public var name: String
    public var age: Int
    public var heightCm: Int
    public var weightKg: Int
    public var experience: String
    public var style: String
    public var preferredCategory: String
    public var budgetCap: Double
    public var avatarData: Data?
    public var isActive: Bool

    public init(
        name: String,
        age: Int,
        heightCm: Int,
        weightKg: Int,
        experience: String,
        style: String,
        preferredCategory: String = "Any",
        budgetCap: Double = 0,
        avatarData: Data? = nil
    ) {
        self.id = UUID()
        self.name = name
        self.age = age
        self.heightCm = heightCm
        self.weightKg = weightKg
        self.experience = experience
        self.style = style
        self.preferredCategory = preferredCategory
        self.budgetCap = budgetCap
        self.avatarData = avatarData
        self.isActive = false
    }
}

extension RiderProfile {
    /// Maps riding style to a catalog category for filters. Downhill / freeride / gravity use **Any** so results are driven by style rules (long-travel gravity bikes), not a single category label that mislabels Enduro vs Downhill.
    public static func inferredCategory(for style: String) -> String {
        let s = style.lowercased()
        if s.contains("downhill") || s.contains("freeride") || s.contains("gravity") {
            return "Any"
        }
        if s.contains("trail") || s.contains("all-mountain") || s.contains("all mountain") {
            return "Trail"
        }
        if s.contains("enduro") {
            return "Enduro"
        }
        if s.contains("cross-country") || s.contains("cross country") || s.contains("xc") {
            return "XC / Cross-Country"
        }
        if s.contains("dirt jump") || s.contains("pump") || s.contains("slopestyle") {
            return "Hardtail"
        }
        return "Any"
    }

    /// `nil` means no category bar — same as "Any".
    public var categoryFilterHint: String? {
        let c = Self.inferredCategory(for: style)
        return c == "Any" ? nil : c
    }
}
