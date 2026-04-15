import SwiftUI
import SwiftData

struct BudgetView: View {
    @EnvironmentObject private var filterStore: FilterStore
    @Query private var profiles: [RiderProfile]
    @State private var selectedBikeId: Int = 0
    @State private var tier: GearTier = .mid
    @State private var selectedOptionalIds: Set<String> = []

    private var selectedBike: Bike? { filterStore.catalog.first(where: { $0.id == selectedBikeId }) }
    private var activeProfile: RiderProfile? { profiles.first(where: { $0.isActive }) }
    private var profileBudgetCap: Double { activeProfile?.budgetCap ?? 0 }
    private var ridingDiscipline: RidingDiscipline {
        RidingDiscipline.from(activeProfile?.style ?? "Trail")
    }

    private var mustHaveItems: [GearItem] {
        gearCatalog.filter { $0.requiredFor.contains(ridingDiscipline) }
    }
    private var optionalItems: [GearItem] {
        gearCatalog.filter { !$0.requiredFor.contains(ridingDiscipline) }
    }
    private var selectedOptionalItems: [GearItem] {
        optionalItems.filter { selectedOptionalIds.contains($0.id) }
    }
    private var mustHaveCost: Double { mustHaveItems.reduce(0) { $0 + $1.price(for: tier) } }
    private var optionalCost: Double { selectedOptionalItems.reduce(0) { $0 + $1.price(for: tier) } }
    private var bikeCost: Double { selectedBike?.bestPrice ?? 0 }
    private var totalCost: Double { bikeCost + mustHaveCost + optionalCost + hiddenCostsTotal }
    private var hiddenCostsTotal: Double {
        hiddenCosts.reduce(0) { $0 + ($1.requiredFor.contains(ridingDiscipline) ? $1.cost : 0) }
    }
    private var suggestedBikeId: Int? { smartDefaultBikeId() }
    private var sortedInStockBikes: [Bike] {
        filterStore.catalog
            .filter { !$0.inStock.isEmpty }
            .sorted { ($0.bestPrice ?? .greatestFiniteMagnitude) < ($1.bestPrice ?? .greatestFiniteMagnitude) }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Budget Planner").font(.headline)
                        if let activeProfile {
                            Text("Active profile: \(activeProfile.name)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            if profileBudgetCap > 0 {
                                Text("Budget cap: \(Formatting.currency(profileBudgetCap))")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(Color.rOrange)
                            }
                        } else {
                            Text("Create an active profile to unlock tailored budget suggestions.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding()
                    .background(Color.rCard)
                    .clipShape(RoundedRectangle(cornerRadius: 14))

                    VStack(alignment: .leading, spacing: 12) {
                        Picker("Bike", selection: $selectedBikeId) {
                            ForEach(filterStore.catalog) { bike in
                                Text("\(bike.brand) \(bike.model)").tag(bike.id)
                            }
                        }

                        VStack(alignment: .leading, spacing: 8) {
                            Text("Gear tier")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                            Picker("Tier", selection: $tier) {
                                ForEach(GearTier.allCases, id: \.self) { tier in
                                    Text(tier.label).tag(tier)
                                }
                            }
                            .pickerStyle(.segmented)
                        }

                        HStack(spacing: 8) {
                            statPill("Bike", bikeCost)
                            statPill("Required Gear", mustHaveCost)
                            statPill("Selected Extras", optionalCost)
                        }
                        .font(.caption2)

                        if let bike = selectedBike {
                            Text("Bike selected: \(bike.brand) \(bike.model)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            if activeProfile != nil, bike.id == suggestedBikeId {
                                Text("Suggested bike based on active profile")
                                    .font(.caption2.weight(.semibold))
                                    .foregroundStyle(Color.rOrangeDark)
                            }
                            Text("Grand total: \(Formatting.currency(totalCost))")
                                .font(.headline)
                                .foregroundStyle(totalCost <= profileBudgetCap || profileBudgetCap == 0 ? Color.rGreen : Color.rRed)
                            if profileBudgetCap > 0 && totalCost > profileBudgetCap {
                                Text("Over budget by \(Formatting.currency(totalCost - profileBudgetCap))")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(Color.rRed)
                            }
                        }
                    }
                    .padding()
                    .background(Color.rCard)
                    .clipShape(RoundedRectangle(cornerRadius: 14))

                    if profileBudgetCap > 0 {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Best bikes within profile budget").font(.headline)
                            ForEach(filterStore.catalog.filter { ($0.bestPrice ?? .greatestFiniteMagnitude) <= profileBudgetCap }.prefix(8)) { bike in
                                HStack {
                                    Text("\(bike.brand) \(bike.model)")
                                    Spacer()
                                    Text(Formatting.currency(bike.bestPrice))
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(Color.rGreen)
                                }
                            }
                        }
                        .padding()
                        .background(Color.rCard)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Required Gear (\(ridingDiscipline.label))").font(.headline)
                        Text("These are the non-negotiables for safer riding in your selected discipline.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        ForEach(mustHaveItems) { item in
                            budgetRow(item: item, required: true, selected: true) {}
                        }
                    }
                    .padding()
                    .background(Color.rCard)
                    .clipShape(RoundedRectangle(cornerRadius: 14))

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Optional Gear & Accessories").font(.headline)
                        Text("Toggle useful extras riders often forget to budget for.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        ForEach(optionalItems) { item in
                            budgetRow(
                                item: item,
                                required: false,
                                selected: selectedOptionalIds.contains(item.id)
                            ) {
                                if selectedOptionalIds.contains(item.id) { selectedOptionalIds.remove(item.id) }
                                else { selectedOptionalIds.insert(item.id) }
                            }
                        }
                    }
                    .padding()
                    .background(Color.rCard)
                    .clipShape(RoundedRectangle(cornerRadius: 14))

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Hidden / Forgotten Costs").font(.headline)
                        ForEach(hiddenCosts.filter { $0.requiredFor.contains(ridingDiscipline) }) { cost in
                            HStack(alignment: .top) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(cost.title).font(.subheadline.weight(.semibold))
                                    Text(cost.note).font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text(Formatting.currency(cost.cost))
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(Color.rOrangeDark)
                            }
                            .padding(.vertical, 4)
                        }
                        Divider()
                        HStack {
                            Text("Hidden costs subtotal").font(.caption.weight(.semibold))
                            Spacer()
                            Text(Formatting.currency(hiddenCostsTotal))
                                .font(.caption.weight(.bold))
                        }
                    }
                    .padding()
                    .background(Color.rCard)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.rBackground.ignoresSafeArea())
            .navigationTitle("Budget")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                applySmartDefaultBikeIfNeeded()
            }
            .onChange(of: activeProfile?.id) { _, _ in
                applySmartDefaultBikeIfNeeded()
            }
            .onChange(of: filterStore.catalog.map(\.id)) { _, _ in
                applySmartDefaultBikeIfNeeded()
            }
        }
    }

    private func applySmartDefaultBikeIfNeeded() {
        let currentIsValid = filterStore.catalog.contains(where: { $0.id == selectedBikeId })
        if selectedBikeId != 0 && currentIsValid {
            return
        }
        selectedBikeId = smartDefaultBikeId() ?? 0
    }

    private func smartDefaultBikeId() -> Int? {
        let candidates = sortedInStockBikes
        guard !candidates.isEmpty else { return filterStore.catalog.first?.id }
        guard let activeProfile else { return candidates.first?.id }

        let preferredCategory = activeProfile.preferredCategory
        let profileStyle = RidingDiscipline.from(activeProfile.style)
        let budgetCap = activeProfile.budgetCap

        func matchesCategory(_ bike: Bike) -> Bool {
            guard preferredCategory != "Any" else { return true }
            return bike.category == preferredCategory ||
                (preferredCategory == "Hardtail" && bike.suspension == "Hardtail")
        }

        func matchesStyle(_ bike: Bike) -> Bool {
            switch profileStyle {
            case .downhill, .freeride:
                return bike.category == "Downhill" || bike.category == "Enduro" || bike.travelMM >= 160
            case .enduro:
                return bike.category == "Enduro" || bike.travelMM >= 150
            case .crossCountry:
                return bike.category == "XC / Cross-Country" || (bike.suspension == "Hardtail" && bike.travelMM <= 130)
            case .dirtJump:
                return bike.suspension == "Hardtail" && (bike.wheel == "26\"" || bike.wheel == "27.5\"")
            case .allMountain:
                return bike.category == "All-Mountain" || bike.category == "Trail" || bike.isEbike
            case .trail:
                return bike.category == "Trail" || bike.category == "All-Mountain" || bike.isEbike
            }
        }

        let styleAndCategoryMatches = candidates.filter { matchesStyle($0) && matchesCategory($0) }
        if budgetCap > 0 {
            if let withinBudget = styleAndCategoryMatches.first(where: { ($0.bestPrice ?? .greatestFiniteMagnitude) <= budgetCap }) {
                return withinBudget.id
            }
        } else if let firstStrongMatch = styleAndCategoryMatches.first {
            return firstStrongMatch.id
        }

        let categoryMatches = candidates.filter(matchesCategory)
        if budgetCap > 0 {
            if let withinBudgetCategory = categoryMatches.first(where: { ($0.bestPrice ?? .greatestFiniteMagnitude) <= budgetCap }) {
                return withinBudgetCategory.id
            }
            if let cheapestCategory = categoryMatches.first {
                return cheapestCategory.id
            }
            if let cheapestWithinBudget = candidates.first(where: { ($0.bestPrice ?? .greatestFiniteMagnitude) <= budgetCap }) {
                return cheapestWithinBudget.id
            }
        }

        return candidates.first?.id
    }

    @ViewBuilder
    private func budgetRow(item: GearItem, required: Bool, selected: Bool, onToggle: @escaping () -> Void) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(item.name).font(.subheadline.weight(.semibold))
                    if required {
                        Text("Required")
                            .font(.caption2.weight(.semibold))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.rOrangeLight)
                            .clipShape(Capsule())
                    }
                }
                Text(item.note)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text(Formatting.currency(item.price(for: tier)))
                .font(.caption.weight(.semibold))
            if !required {
                Button(selected ? "Added" : "Add") { onToggle() }
                    .buttonStyle(.bordered)
            }
        }
        .padding(.vertical, 4)
    }

    private func statPill(_ title: String, _ value: Double) -> some View {
        VStack(spacing: 2) {
            Text(Formatting.currency(value))
                .font(.caption.weight(.bold))
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(Color.rOrangeLight.opacity(0.4))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

private enum RidingDiscipline: CaseIterable {
    case trail
    case enduro
    case downhill
    case crossCountry
    case allMountain
    case freeride
    case dirtJump

    var label: String {
        switch self {
        case .trail: return "Trail"
        case .enduro: return "Enduro"
        case .downhill: return "Downhill"
        case .crossCountry: return "Cross-Country"
        case .allMountain: return "All-Mountain"
        case .freeride: return "Freeride"
        case .dirtJump: return "Dirt Jump / Pump Track"
        }
    }

    static func from(_ style: String) -> RidingDiscipline {
        let value = style.lowercased()
        if value.contains("downhill") { return .downhill }
        if value.contains("enduro") { return .enduro }
        if value.contains("cross") || value.contains("xc") { return .crossCountry }
        if value.contains("all-mountain") || value.contains("all mountain") { return .allMountain }
        if value.contains("freeride") { return .freeride }
        if value.contains("dirt jump") || value.contains("pump") { return .dirtJump }
        return .trail
    }
}

private enum GearTier: CaseIterable {
    case budget
    case mid
    case premium

    var label: String {
        switch self {
        case .budget: return "Budget"
        case .mid: return "Mid"
        case .premium: return "Premium"
        }
    }

    var multiplier: Double {
        switch self {
        case .budget: return 0.8
        case .mid: return 1.0
        case .premium: return 1.3
        }
    }
}

private struct GearItem: Identifiable {
    let id: String
    let name: String
    let baseCost: Double
    let requiredFor: Set<RidingDiscipline>
    let note: String

    func price(for tier: GearTier) -> Double {
        (baseCost * tier.multiplier).rounded()
    }
}

private struct HiddenCost: Identifiable {
    let id: String
    let title: String
    let cost: Double
    let note: String
    let requiredFor: Set<RidingDiscipline>
}

private let gearCatalog: [GearItem] = [
    .init(id: "helmet", name: "Helmet", baseCost: 180, requiredFor: Set(RidingDiscipline.allCases), note: "Core protection for every ride."),
    .init(id: "gloves", name: "Gloves", baseCost: 55, requiredFor: Set(RidingDiscipline.allCases), note: "Grip, comfort, and crash abrasion protection."),
    .init(id: "knees", name: "Knee Pads", baseCost: 120, requiredFor: [.trail, .enduro, .downhill, .allMountain, .freeride], note: "Strongly recommended for descending disciplines."),
    .init(id: "elbows", name: "Elbow Pads", baseCost: 110, requiredFor: [.enduro, .downhill, .freeride], note: "Required for enduro race stages and bike parks."),
    .init(id: "fullface", name: "Full-Face Helmet", baseCost: 260, requiredFor: [.downhill, .freeride], note: "Critical for high-speed gravity riding."),
    .init(id: "bodyarmor", name: "Body Armour / Back Protector", baseCost: 220, requiredFor: [.downhill, .freeride], note: "Extra torso protection for gravity disciplines."),
    .init(id: "flatshoes", name: "MTB Shoes", baseCost: 150, requiredFor: Set(RidingDiscipline.allCases), note: "Foot stability and pedal traction."),
    .init(id: "pedals", name: "Pedals Upgrade", baseCost: 120, requiredFor: Set(RidingDiscipline.allCases), note: "Many bikes ship with basic pedals."),
    .init(id: "hydropack", name: "Hydration Pack", baseCost: 120, requiredFor: [.trail, .enduro, .allMountain, .crossCountry], note: "Carry water, tools and layers."),
    .init(id: "tools", name: "Trail Tool Kit", baseCost: 95, requiredFor: Set(RidingDiscipline.allCases), note: "Pump, multitool, tube/plug.")
]

private let hiddenCosts: [HiddenCost] = [
    .init(id: "service", title: "First service + setup", cost: 160, note: "Most new bikes need a tune after first rides.", requiredFor: Set(RidingDiscipline.allCases)),
    .init(id: "sealant", title: "Tubeless setup + sealant top-ups", cost: 90, note: "Easy to forget but common running cost.", requiredFor: [.trail, .enduro, .downhill, .allMountain, .freeride, .crossCountry]),
    .init(id: "racefees", title: "Lift passes / race entries", cost: 220, note: "Frequent gravity riders usually incur this quickly.", requiredFor: [.downhill, .enduro, .freeride]),
    .init(id: "transport", title: "Rack / shuttle fuel", cost: 140, note: "Travel logistics often exceed expected budget.", requiredFor: [.downhill, .enduro, .allMountain, .freeride]),
    .init(id: "consumables", title: "Brake pads / drivetrain wear", cost: 130, note: "Higher wear on steep or muddy terrain.", requiredFor: Set(RidingDiscipline.allCases))
]
