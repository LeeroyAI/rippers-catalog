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
