import SwiftUI
import SwiftData

struct ProfileTabView: View {
    @Query private var profiles: [RiderProfile]
    @EnvironmentObject private var appState: AppState

    @State private var showSizing = false
    @State private var showBudget = false
    @State private var showTrip = false
    @State private var showHelp = false

    private var activeProfile: RiderProfile? { profiles.first(where: { $0.isActive }) }

    var body: some View {
        NavigationStack {
            List {
                if let profile = activeProfile {
                    Section {
                        HStack(spacing: 12) {
                            avatarView(data: profile.avatarData)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(profile.name)
                                    .font(.headline)
                                Text("\(profile.experience) · \(profile.style)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                if profile.budgetCap > 0 {
                                    Text("Budget cap \(Formatting.currency(profile.budgetCap))")
                                        .font(.caption2)
                                        .foregroundStyle(Color.rOrange)
                                }
                            }
                            Spacer()
                            Button("Edit") { appState.activeTab = .search }
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(Color.rOrange)
                        }
                        .padding(.vertical, 4)
                    }

                    Section("Rider Summary") {
                        profileSummaryGrid(profile)
                    }
                } else {
                    Section {
                        Button {
                            appState.activeTab = .search
                        } label: {
                            Label("Create Rider Profile", systemImage: "person.badge.plus")
                                .foregroundStyle(Color.rOrange)
                        }
                    }
                }

                Section("Tools") {
                    Button {
                        showSizing = true
                    } label: {
                        Label("Sizing Guide", systemImage: "ruler")
                    }
                    .foregroundStyle(.primary)

                    Button {
                        showBudget = true
                    } label: {
                        Label("Budget Planner", systemImage: "dollarsign.circle")
                    }
                    .foregroundStyle(.primary)

                    Button {
                        showTrip = true
                    } label: {
                        Label("Trip Planner", systemImage: "map")
                    }
                    .foregroundStyle(.primary)

                    Button {
                        showHelp = true
                    } label: {
                        Label("Help", systemImage: "questionmark.circle")
                    }
                    .foregroundStyle(.primary)
                }
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.inline)
        }
        .sheet(isPresented: $showSizing) { SizingView() }
        .sheet(isPresented: $showBudget) { BudgetView() }
        .sheet(isPresented: $showTrip) { TripPlannerView() }
        .sheet(isPresented: $showHelp) { HelpView() }
    }

    private func profileSummaryGrid(_ profile: RiderProfile) -> some View {
        let category = RiderProfile.inferredCategory(for: profile.style)
        return VStack(spacing: 0) {
            summaryRow(icon: "figure.stand", label: "Height", value: profile.heightCm > 0 ? "\(profile.heightCm) cm" : "—")
            Divider().padding(.leading, 36)
            summaryRow(icon: "scalemass", label: "Weight", value: profile.weightKg > 0 ? "\(profile.weightKg) kg" : "—")
            if profile.age > 0 {
                Divider().padding(.leading, 36)
                summaryRow(icon: "birthday.cake", label: "Age", value: "\(profile.age)")
            }
            Divider().padding(.leading, 36)
            summaryRow(icon: "star.fill", label: "Experience", value: profile.experience)
            Divider().padding(.leading, 36)
            summaryRow(icon: "bicycle", label: "Riding style", value: profile.style)
            Divider().padding(.leading, 36)
            summaryRow(icon: "tag", label: "Bike category", value: category == "Any" ? "All categories" : category)
            Divider().padding(.leading, 36)
            summaryRow(icon: "dollarsign.circle", label: "Budget cap", value: profile.budgetCap > 0 ? Formatting.currency(profile.budgetCap) : "No limit")
        }
    }

    private func summaryRow(icon: String, label: String, value: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.rOrange)
                .frame(width: 20)
            Text(label)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .font(.subheadline.weight(.semibold))
        }
        .padding(.vertical, 6)
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
        .frame(width: 44, height: 44)
        .clipShape(Circle())
    }
}
