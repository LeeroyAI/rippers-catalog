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
