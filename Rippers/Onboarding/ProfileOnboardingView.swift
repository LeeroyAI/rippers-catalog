import SwiftUI
import SwiftData

struct ProfileOnboardingView: View {
    @Environment(\.modelContext) private var modelContext
    @FocusState private var focusedField: Field?
    @AppStorage("rippers.searchWalkthroughCompleted") private var walkthroughCompleted = false

    @State private var name = ""
    @State private var ageText = ""
    @State private var heightText = ""
    @State private var weightText = ""
    @State private var budgetText = ""
    @State private var experience = "Beginner"
    @State private var style = "Trail"
    @State private var walkthroughStep = 0

    let onComplete: () -> Void

    private let experiences = ["Beginner", "Intermediate", "Expert"]
    private let styles = [
        "Trail",
        "Enduro",
        "Downhill",
        "Cross-Country",
        "All-Mountain",
        "Freeride",
        "Dirt Jump / Pump Track"
    ]

    private enum Field: Hashable {
        case name, age, height, weight, budget
    }

    private var isValid: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && (100...220).contains(Int(heightText) ?? 0)
            && (20...150).contains(Int(weightText) ?? 0)
            && (ageText.isEmpty || (5...100).contains(Int(ageText) ?? 0))
    }

    private var selectedStyleSummary: String {
        switch style {
        case "Trail":
            return "Balanced all-round riding."
        case "Enduro":
            return "Steep descents with strong climbing ability."
        case "Downhill":
            return "Bike-park and gravity-focused riding."
        case "Cross-Country":
            return "Efficiency and speed on climbs and flats."
        case "All-Mountain":
            return "Versatile big-day mountain riding."
        case "Freeride":
            return "Aggressive descending, jumps, and technical lines."
        case "Dirt Jump / Pump Track":
            return "Playful hardtail-style jumps and flow."
        default:
            return "Select the style you ride most."
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    heroCard
                    profileCard
                    continueButton
                }
                .padding()
            }
            .background(Color.rBackground.ignoresSafeArea())
            .toolbar {
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Done") { focusedField = nil }
                }
            }
            .overlay {
                if !walkthroughCompleted {
                    walkthroughOverlay
                }
            }
        }
    }

    private var walkthroughOverlay: some View {
        let step = walkthroughSteps[min(max(walkthroughStep, 0), walkthroughSteps.count - 1)]
        return ZStack {
            Color.black.opacity(0.38)
                .ignoresSafeArea()
                .onTapGesture {}

            VStack(spacing: 0) {
                Spacer()
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text("Quick Guide")
                            .font(.headline)
                        Spacer()
                        Text("\(walkthroughStep + 1)/\(walkthroughSteps.count)")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                    Text(step.title)
                        .font(.title3.weight(.bold))
                    Text(step.body)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    HStack {
                        Button("Skip") {
                            walkthroughCompleted = true
                        }
                        .buttonStyle(.bordered)

                        Spacer()

                        Button(walkthroughStep == walkthroughSteps.count - 1 ? "Get Started" : "Next") {
                            if walkthroughStep < walkthroughSteps.count - 1 {
                                walkthroughStep += 1
                            } else {
                                walkthroughCompleted = true
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(Color.rOrange)
                    }
                }
                .padding(16)
                .background(Color.rCard)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .padding()
            }
        }
        .transition(.opacity)
    }

    private var walkthroughSteps: [(title: String, body: String)] {
        [
            (
                "Create your rider profile first",
                "Add height, weight, style, and budget so Rippers can tailor every recommendation to you."
            ),
            (
                "Run a profile-tailored search",
                "Enable tailoring and refine by category, wheel, travel, eBike, and budget to find your best matches."
            ),
            (
                "Compare, size, budget, and plan trips",
                "Open results to compare bikes, validate fit in Sizing, check spend in Budget, and plan destinations in Trip Planner."
            )
        ]
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Start Your Rider Profile")
                    .font(.title2.weight(.bold))
                Spacer()
                Image(systemName: "mountain.2.fill")
                    .foregroundStyle(Color.rOrange)
            }
            Text("Tell us a few details first so every search, comparison, and recommendation matches your riding needs.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding(14)
        .background(
            LinearGradient(
                colors: [Color.rCard, Color.rOrangeLight],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.rBorder, lineWidth: 1))
    }

    private var profileCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Rider details")
                .font(.caption.weight(.bold))
                .foregroundStyle(Color.rOrange)

            VStack(alignment: .leading, spacing: 5) {
                fieldLabel("Profile name")
                TextField("e.g. Weekend Enduro Setup", text: $name)
                    .textFieldStyle(.roundedBorder)
                    .focused($focusedField, equals: .name)
                    .textInputAutocapitalization(.words)
            }

            VStack(alignment: .leading, spacing: 5) {
                fieldLabel("Body metrics")
                HStack(spacing: 8) {
                    TextField("Age", text: $ageText)
                        .keyboardType(.numberPad)
                        .focused($focusedField, equals: .age)
                    TextField("Height cm", text: $heightText)
                        .keyboardType(.numberPad)
                        .focused($focusedField, equals: .height)
                }
                .textFieldStyle(.roundedBorder)
                TextField("Weight kg", text: $weightText)
                    .textFieldStyle(.roundedBorder)
                    .keyboardType(.numberPad)
                    .focused($focusedField, equals: .weight)
            }

            VStack(alignment: .leading, spacing: 5) {
                fieldLabel("Budget")
                TextField("Budget cap (optional)", text: $budgetText)
                    .textFieldStyle(.roundedBorder)
                    .keyboardType(.numberPad)
                    .focused($focusedField, equals: .budget)
            }

            Picker("Experience", selection: $experience) {
                ForEach(experiences, id: \.self, content: Text.init)
            }
            .pickerStyle(.segmented)

            VStack(alignment: .leading, spacing: 4) {
                Text("Select riding style")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Menu {
                    ForEach(styles, id: \.self) { option in
                        Button {
                            style = option
                        } label: {
                            Label(option, systemImage: option == style ? "checkmark.circle.fill" : "circle")
                        }
                    }
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(style)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Color.primary)
                            Text(selectedStyleSummary)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                        Spacer()
                        Image(systemName: "chevron.up.chevron.down")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 10)
                    .background(Color.rBackground.opacity(0.7))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(12)
        .background(Color.rCard)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .onChange(of: ageText) { _, newValue in
            let digits = newValue.filter(\.isNumber)
            if digits != newValue { ageText = digits }
        }
        .onChange(of: heightText) { _, newValue in
            let digits = newValue.filter(\.isNumber)
            if digits != newValue { heightText = digits }
        }
        .onChange(of: weightText) { _, newValue in
            let digits = newValue.filter(\.isNumber)
            if digits != newValue { weightText = digits }
        }
        .onChange(of: budgetText) { _, newValue in
            let digits = newValue.filter(\.isNumber)
            if digits != newValue { budgetText = digits }
        }
    }

    private var continueButton: some View {
        Button("Create Profile & Continue") {
            createProfile()
        }
        .buttonStyle(.borderedProminent)
        .tint(Color.rOrange)
        .disabled(!isValid)
    }

    private func createProfile() {
        let profile = RiderProfile(
            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
            age: Int(ageText) ?? 0,
            heightCm: Int(heightText) ?? 0,
            weightKg: Int(weightText) ?? 0,
            experience: experience,
            style: style,
            preferredCategory: inferredCategory(for: style),
            budgetCap: Double(budgetText) ?? 0
        )
        profile.isActive = true
        modelContext.insert(profile)
        onComplete()
    }

    private func fieldLabel(_ text: String) -> some View {
        Text(text)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(.secondary)
    }

    private func inferredCategory(for style: String) -> String {
        switch RidingDisciplineKind.from(style) {
        case .trail:
            return "Trail"
        case .gravity:
            return "Enduro"
        case .crossCountry:
            return "XC / Cross-Country"
        case .jump:
            return "Hardtail"
        case .other:
            return "Any"
        }
    }
}
