import SwiftUI
import SwiftData

struct SizingView: View {
    @EnvironmentObject private var filterStore: FilterStore
    @Query private var profiles: [RiderProfile]
    @State private var manualHeightText: String = ""
    @State private var manualStyle: RidingStyle = .trail
    @State private var selectedSizingBike: Bike? = nil

    private var activeProfile: RiderProfile? { profiles.first(where: { $0.isActive }) }
    private var effectiveHeight: Int? { activeProfile?.heightCm ?? Int(manualHeightText) }
    private var effectiveStyle: RidingStyle {
        guard let profile = activeProfile else { return manualStyle }
        return RidingStyle.from(profile.style)
    }
    private var recommendation: SizeRecommendation? {
        guard let h = effectiveHeight, (100...220).contains(h) else { return nil }
        return buildRecommendation(heightCm: h, style: effectiveStyle)
    }
    private var fitSummary: FitSummary? {
        guard let recommendation else { return nil }
        return summarizeFit(for: recommendation)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    profileHeroCard
                    recommendationCard
                    wheelGuidanceCard
                    kidsYouthSizingCard
                    wheelSizeGuideCard
                    fitCoverageCard
                    chartReferenceCard
                    measurementTipsCard
                    brandNotesCard
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.rBackground.ignoresSafeArea())
            .navigationTitle("Sizing")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(item: $selectedSizingBike) { bike in
                BikeDetailView(bike: bike)
            }
        }
    }

    private var profileHeroCard: some View {
        Group {
            if let profile = activeProfile {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .top, spacing: 12) {
                        avatarView(data: profile.avatarData)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(profile.name)
                                .font(.title3.weight(.bold))
                            HStack(spacing: 6) {
                                sizingPill(profile.experience, color: Color.rOrange)
                                sizingPill(profile.style, color: Color.rOrangeDark)
                            }
                            Text("\(profile.heightCm) cm  ·  \(profile.weightKg) kg")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        if let rec = recommendation {
                            VStack(alignment: .trailing, spacing: 2) {
                                Text("Your size")
                                    .font(.caption2.weight(.semibold))
                                    .foregroundStyle(.secondary)
                                Text(rec.primary)
                                    .font(.system(size: 34, weight: .bold))
                                    .foregroundStyle(Color.rOrange)
                                if let sec = rec.secondary {
                                    Text("or \(sec)")
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }

                    if let fitSummary {
                        VStack(alignment: .leading, spacing: 6) {
                            HStack(spacing: 8) {
                                fitBadge("Direct fit", "\(fitSummary.fullFitCount)", color: Color.rGreen)
                                fitBadge("Nearby", "\(fitSummary.partialFitCount)", color: Color.rYellow)
                                fitBadge("No fit", "\(fitSummary.noFitCount)", color: Color.rRed.opacity(0.7))
                            }
                            Text(fitSummary.confidenceLabel)
                                .font(.caption2.weight(.semibold))
                                .padding(.horizontal, 8).padding(.vertical, 4)
                                .background(fitSummary.confidenceColor.opacity(0.14))
                                .foregroundStyle(fitSummary.confidenceColor)
                                .clipShape(Capsule())
                        }
                    }
                }
                .padding(14)
                .background(LinearGradient(colors: [Color.rCard, Color.rOrangeLight], startPoint: .topLeading, endPoint: .bottomTrailing))
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.rBorder, lineWidth: 1))
            } else {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Sizing Assistant")
                                .font(.title3.weight(.bold))
                            Text("Enter your height and riding style below to get a frame size and catalog fit report.")
                                .font(.subheadline).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Image(systemName: "ruler")
                            .font(.title2.weight(.bold))
                            .foregroundStyle(Color.rOrange)
                    }
                    TextField("Height (cm)", text: $manualHeightText)
                        .textFieldStyle(.roundedBorder)
                        .keyboardType(.numberPad)
                        .onChange(of: manualHeightText) { _, newValue in
                            let digits = newValue.filter(\.isNumber)
                            if digits != newValue { manualHeightText = digits }
                        }
                    if !manualHeightText.isEmpty, !(100...220).contains(Int(manualHeightText) ?? 0) {
                        Text("Enter a height between 100 and 220 cm.")
                            .font(.caption)
                            .foregroundStyle(Color.rRed)
                    }
                    Picker("Riding style", selection: $manualStyle) {
                        ForEach(RidingStyle.allCases, id: \.self) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.segmented)
                }
                .padding(14)
                .background(LinearGradient(colors: [Color.rCard, Color.rOrangeLight], startPoint: .topLeading, endPoint: .bottomTrailing))
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.rBorder, lineWidth: 1))
            }
        }
    }

    private func sizingPill(_ label: String, color: Color) -> some View {
        Text(label)
            .font(.caption2.weight(.bold))
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(color.opacity(0.15))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }

    private func fitBadge(_ title: String, _ value: String, color: Color) -> some View {
        VStack(spacing: 1) {
            Text(value).font(.caption.weight(.bold)).foregroundStyle(color)
            Text(title).font(.caption2).foregroundStyle(.secondary)
        }
        .padding(.horizontal, 8).padding(.vertical, 4)
        .background(color.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func avatarView(data: Data?) -> some View {
        Group {
            if let data, let image = UIImage(data: data) {
                Image(uiImage: image).resizable().scaledToFill()
            } else {
                ZStack {
                    Circle().fill(Color.rOrangeLight)
                    Image(systemName: "person.fill").foregroundStyle(Color.rOrange)
                }
            }
        }
        .frame(width: 48, height: 48)
        .clipShape(Circle())
    }

    private var recommendationCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Recommended Frame Size").font(.headline)
            if let recommendation {
                HStack(alignment: .lastTextBaseline, spacing: 8) {
                    Text(recommendation.primary)
                        .font(.system(size: 36, weight: .bold))
                        .foregroundStyle(Color.rOrange)
                    if let secondary = recommendation.secondary {
                        Text("or \(secondary)")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                }
                if let fitSummary {
                    Text(fitSummary.confidenceLabel)
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(fitSummary.confidenceColor.opacity(0.14))
                        .foregroundStyle(fitSummary.confidenceColor)
                        .clipShape(Capsule())
                }
                Text(recommendation.note)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                if !recommendation.notes.isEmpty {
                    VStack(alignment: .leading, spacing: 3) {
                        ForEach(recommendation.notes, id: \.self) { note in
                            Text("• \(note)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            } else {
                Text("Enter rider height between 100 cm and 220 cm to calculate a size.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.rCard)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private var wheelGuidanceCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Wheel Guidance").font(.headline)
            if let h = effectiveHeight {
                let guidance = wheelGuidance(heightCm: h, style: effectiveStyle)
                Text(guidance.size)
                    .font(.title3.weight(.bold))
                    .foregroundStyle(Color.rOrangeDark)
                Text(guidance.note)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                Text("Add rider height to show wheel-size guidance.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.rCard)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private var fitCoverageCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Catalog Fit Coverage").font(.headline)
            if let recommendation, let fitSummary {
                Text("Bikes in the catalog that stock size \(recommendation.label) — tap any to see full details.")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                if fitSummary.topMatches.isEmpty {
                    Text("No catalog bikes currently stock your size. Try Live Search on the Home tab.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(fitSummary.topMatches.prefix(8), id: \.id) { bike in
                        Button {
                            selectedSizingBike = bike
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("\(bike.brand) \(bike.model)")
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(.primary)
                                        .lineLimit(1)
                                    Text("Sizes: \(bike.sizes.joined(separator: ", "))  ·  \(bike.category)")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                VStack(alignment: .trailing, spacing: 2) {
                                    Text(Formatting.currency(bike.bestPrice))
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(Color.rGreen)
                                    Image(systemName: "chevron.right")
                                        .font(.caption2.weight(.semibold))
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .padding(10)
                            .background(Color.rBackground.opacity(0.6))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                        .buttonStyle(.plain)
                    }
                }
            } else {
                Text("Enter rider details to evaluate which bikes match your size.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.rCard)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private var chartReferenceCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Frame Size Reference").font(.headline)
            ForEach(sizeChartRows, id: \.size) { row in
                HStack(alignment: .top) {
                    Text(row.size)
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Color.rOrange)
                        .frame(width: 38, alignment: .leading)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(row.heightRange).font(.caption.weight(.semibold))
                        Text("Reach \(row.reachRange)  •  \(row.bestFor)")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            Text("Height bands overlap by design. Aggressive descending often trends up a size; XC-focused climbing often trends down.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.rCard)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private var measurementTipsCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("How To Measure Better").font(.headline)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                ForEach(measurementSteps, id: \.title) { step in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 6) {
                            Text(step.id)
                                .font(.caption.weight(.bold))
                                .foregroundStyle(.white)
                                .frame(width: 18, height: 18)
                                .background(Color.rOrange)
                                .clipShape(Circle())
                            Text(step.title)
                                .font(.caption.weight(.semibold))
                        }
                        Text(step.body)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.rBackground.opacity(0.7))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.rCard)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private var kidsYouthSizingCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Kids & Youth Sizing").font(.headline)
            VStack(spacing: 0) {
                HStack {
                    tableHeader("Age")
                    tableHeader("Height")
                    tableHeader("Wheel")
                    tableHeader("Frame")
                }
                .background(Color.rOrange)

                ForEach(kidsSizingRows, id: \.age) { row in
                    HStack(alignment: .top) {
                        tableCell(row.age)
                        tableCell(row.height)
                        tableCell(row.wheel, isStrong: true)
                        tableCell(row.frame)
                    }
                    .background(Color.rCard)
                    .overlay(Rectangle().frame(height: 1).foregroundStyle(Color.rBorder), alignment: .bottom)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.rCard)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private var wheelSizeGuideCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Wheel Size Guide").font(.headline)
            ForEach(wheelGuideRows, id: \.size) { row in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(row.size)
                            .font(.headline.weight(.bold))
                            .foregroundStyle(row.color)
                        Spacer()
                        Text(row.tag)
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                    Text(row.title)
                        .font(.caption.weight(.semibold))
                    Text(row.body)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .padding(10)
                .background(Color.rBackground.opacity(0.7))
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.rCard)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private var brandNotesCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Brand Sizing Notes").font(.headline)
            ForEach(brandSizingNotes, id: \.brand) { row in
                HStack(alignment: .top) {
                    Text(row.brand)
                        .font(.caption.weight(.semibold))
                        .frame(width: 90, alignment: .leading)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(row.tendency)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Color.rOrangeDark)
                        Text(row.note)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.rCard)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private func buildRecommendation(heightCm: Int, style: RidingStyle) -> SizeRecommendation {
        let chart: [(max: Int, sizes: [String], label: String)] = [
            (152, ["XS"], "Extra Small (XS)"),
            (162, ["XS", "S"], "XS-S"),
            (170, ["S"], "Small (S)"),
            (178, ["S", "M"], "S-M"),
            (186, ["M"], "Medium (M)"),
            (193, ["M", "L"], "M-L"),
            (200, ["L"], "Large (L)"),
            (208, ["L", "XL"], "L-XL"),
            (999, ["XL"], "Extra Large (XL)")
        ]
        let entry = chart.first(where: { heightCm <= $0.max }) ?? chart[chart.count - 1]
        var notes: [String] = []
        if heightCm < 162 { notes.append("Look for models that stock XS; not all brands do.") }
        if heightCm > 193 { notes.append("Double-check stack/reach; some XL frames still run short.") }

        let primary = entry.sizes.first ?? "M"
        let secondary = entry.sizes.count > 1 ? entry.sizes[1] : nil
        let note: String
        switch style {
        case .gravity:
            note = secondary != nil ? "Gravity riding favors stability. Lean toward \(secondary!) where possible." : "Gravity riding favors a stable cockpit and longer reach."
        case .crossCountry:
            note = "XC riding favors efficient climbing and snappy handling. Lean toward the smaller end if between sizes."
        case .trail:
            note = "Trail fit is usually true to chart. Choose smaller for agility, larger for stability."
        }
        return SizeRecommendation(primary: primary, secondary: secondary, all: entry.sizes, label: entry.label, note: note, notes: notes)
    }

    private func wheelGuidance(heightCm: Int, style: RidingStyle) -> (size: String, note: String) {
        if style == .gravity && heightCm >= 168 {
            return ("29\" or Mullet", "Gravity riders often choose 29\" front for rollover and mixed-wheel setups for agility.")
        }
        if heightCm < 162 {
            return ("27.5\"", "At this height, 27.5\" usually gives better fit geometry and easier ground reach.")
        }
        if heightCm < 175 {
            return ("27.5\" or 29\"", "You are in the overlap zone. Either can work based on handling preference.")
        }
        return ("29\"", "At this height, 29\" usually provides better momentum and trail efficiency.")
    }

    private func summarizeFit(for recommendation: SizeRecommendation) -> FitSummary {
        let fitted = filterStore.catalog.filter { bike in
            !Set(bike.sizes).isDisjoint(with: Set(recommendation.all))
        }
        let adjacent = adjacentSizes(for: recommendation.all)
        let partial = filterStore.catalog.filter { bike in
            Set(bike.sizes).isDisjoint(with: Set(recommendation.all)) &&
            !Set(bike.sizes).isDisjoint(with: Set(adjacent))
        }
        let noFitCount = max(0, filterStore.catalog.count - fitted.count - partial.count)
        let coverage = filterStore.catalog.isEmpty ? 0 : Double(fitted.count) / Double(filterStore.catalog.count)
        let confidenceLabel: String
        let confidenceColor: Color
        let total = filterStore.catalog.count
        switch coverage {
        case 0.55...1:
            confidenceLabel = "High fit — \(fitted.count)/\(total) catalog bikes"
            confidenceColor = Color.rGreen
        case 0.30..<0.55:
            confidenceLabel = "Medium fit — \(fitted.count)/\(total) catalog bikes"
            confidenceColor = Color.rYellow
        default:
            confidenceLabel = "Low fit — \(fitted.count)/\(total) catalog bikes"
            confidenceColor = Color.rRed
        }
        return FitSummary(
            fullFitCount: fitted.count,
            partialFitCount: partial.count,
            noFitCount: noFitCount,
            confidenceLabel: confidenceLabel,
            confidenceColor: confidenceColor,
            topMatches: fitted.sorted { ($0.bestPrice ?? .greatestFiniteMagnitude) < ($1.bestPrice ?? .greatestFiniteMagnitude) }
        )
    }

    private func adjacentSizes(for sizes: [String]) -> [String] {
        let order = ["XS", "S", "M", "L", "XL", "XXL"]
        let indexes = sizes.compactMap { order.firstIndex(of: $0) }
        let adjacentIdx = Set(indexes.flatMap { [$0 - 1, $0 + 1] }.filter { $0 >= 0 && $0 < order.count })
        return adjacentIdx.map { order[$0] }
    }

    private var sizeChartRows: [SizeChartRow] {
        [
            .init(size: "XS", heightRange: "148-155 cm", reachRange: "420-430mm", bestFor: "Shorter adult riders"),
            .init(size: "S", heightRange: "155-168 cm", reachRange: "430-450mm", bestFor: "Agile handling and tall youth"),
            .init(size: "M", heightRange: "168-180 cm", reachRange: "450-470mm", bestFor: "Balanced all-round trail fit"),
            .init(size: "L", heightRange: "178-190 cm", reachRange: "470-490mm", bestFor: "Stability for taller riders"),
            .init(size: "XL", heightRange: "188-200 cm", reachRange: "490-510mm", bestFor: "Big riders and fast terrain"),
            .init(size: "XXL", heightRange: "200+ cm", reachRange: "510mm+", bestFor: "Very tall riders")
        ]
    }

    private var brandSizingNotes: [BrandSizingRow] {
        [
            .init(brand: "Specialized", tendency: "Runs large", note: "Many riders can size down; compare reach numbers."),
            .init(brand: "Santa Cruz", tendency: "Runs large", note: "Long reach on many models, test M vs L."),
            .init(brand: "Trek", tendency: "True to size", note: "Generally consistent across trail/enduro lines."),
            .init(brand: "Canyon", tendency: "Often long", note: "Conservative sizing is safer when between sizes.")
        ]
    }

    private var kidsSizingRows: [KidsSizingRow] {
        [
            .init(age: "4-6", height: "100-115cm", wheel: "12\"-14\"", frame: "Balance/single speed"),
            .init(age: "5-8", height: "110-125cm", wheel: "16\"-20\"", frame: "Kids MTB"),
            .init(age: "7-11", height: "120-140cm", wheel: "24\"", frame: "Entry trail hardtail"),
            .init(age: "9-13", height: "135-155cm", wheel: "24\"", frame: "Performance 24\""),
            .init(age: "12-15", height: "150-170cm", wheel: "27.5\"", frame: "Youth / XS-S"),
            .init(age: "14+", height: "165cm+", wheel: "29\"", frame: "Adult S-M")
        ]
    }

    private var wheelGuideRows: [WheelGuideRow] {
        [
            .init(size: "24\"", title: "Kids", body: "Scaled geometry for young riders; lighter and easier to control.", tag: "120-155cm", color: Color.rOrange),
            .init(size: "27.5\"", title: "Agility", body: "Snappier handling for tighter trails and shorter riders.", tag: "155-178cm", color: Color.rBlue),
            .init(size: "29\"", title: "Efficiency", body: "Better rollover and momentum for trail and XC riding.", tag: "168cm+", color: Color.rGreen),
            .init(size: "29/27.5", title: "Mullet", body: "29 front stability with a more playful 27.5 rear feel.", tag: "All heights", color: Color.rOrangeDark)
        ]
    }

    private var measurementSteps: [MeasurementStep] {
        [
            .init(id: "1", title: "Barefoot Height", body: "Stand against a wall with no shoes and measure to top of head."),
            .init(id: "2", title: "Inseam Length", body: "Use a book spine-up to estimate standover clearance."),
            .init(id: "3", title: "Arm Reach", body: "Long wingspan can justify sizing up for cockpit comfort."),
            .init(id: "4", title: "Test Ride", body: "If between sizes, ride both when possible before purchase.")
        ]
    }

    private func tableHeader(_ text: String) -> some View {
        Text(text)
            .font(.caption2.weight(.bold))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 8)
            .padding(.vertical, 8)
    }

    private func tableCell(_ text: String, isStrong: Bool = false) -> some View {
        Text(text)
            .font(isStrong ? .caption.weight(.semibold) : .caption)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 8)
            .padding(.vertical, 8)
    }
}

private enum RidingStyle: CaseIterable {
    case trail
    case gravity
    case crossCountry

    var label: String {
        switch self {
        case .trail: return "Trail"
        case .gravity: return "Gravity"
        case .crossCountry: return "Cross-Country"
        }
    }

    static func from(_ value: String) -> RidingStyle {
        let normalized = value.lowercased()
        if normalized.contains("gravity") || normalized.contains("enduro") || normalized.contains("downhill") || normalized.contains("freeride") {
            return .gravity
        }
        if normalized.contains("cross") || normalized.contains("xc") {
            return .crossCountry
        }
        return .trail
    }
}

private struct SizeRecommendation {
    let primary: String
    let secondary: String?
    let all: [String]
    let label: String
    let note: String
    let notes: [String]
}

private struct FitSummary {
    let fullFitCount: Int
    let partialFitCount: Int
    let noFitCount: Int
    let confidenceLabel: String
    let confidenceColor: Color
    let topMatches: [Bike]
}

private struct SizeChartRow {
    let size: String
    let heightRange: String
    let reachRange: String
    let bestFor: String
}

private struct BrandSizingRow {
    let brand: String
    let tendency: String
    let note: String
}

private struct KidsSizingRow {
    let age: String
    let height: String
    let wheel: String
    let frame: String
}

private struct WheelGuideRow {
    let size: String
    let title: String
    let body: String
    let tag: String
    let color: Color
}

private struct MeasurementStep {
    let id: String
    let title: String
    let body: String
}
