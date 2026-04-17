import SwiftUI
import SwiftData
import PhotosUI
import UIKit

struct SearchView: View {
    @EnvironmentObject private var filterStore: FilterStore
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var catalogStore: CatalogStore
    @Environment(\.modelContext) private var modelContext
    @Query private var profiles: [RiderProfile]

    @State private var maxBudgetText: String = ""
    @State private var profileName: String = ""
    @State private var profileAgeText: String = ""
    @State private var profileHeightText: String = ""
    @State private var profileWeightText: String = ""
    @State private var profileBudgetText: String = ""
    @State private var profileExperience: String = "Beginner"
    @State private var profileStyle: String = "Trail"
    @State private var profileCategory: String = "Any"
    @State private var selectedPhotoItem: PhotosPickerItem?
    @State private var profileAvatarData: Data?
    @State private var photoUploadStatus: String?
    @State private var showAdvancedFilters: Bool = false
    @State private var lastSearchFingerprint: String = ""
    @State private var showClearProfileConfirmation = false
    @State private var savedSearchFlash = false
    @State private var profilePendingDeletion: RiderProfile?
    @State private var selectedForYouBike: Bike?
    @FocusState private var focusedField: Field?
    @AppStorage("rippers.savedSearches") private var savedSearchesData: String = "[]"

    private let categories = ["Any", "Trail", "Enduro", "XC / Cross-Country", "Downhill", "eBike", "Hardtail"]
    private let wheels = ["Any", "24\"", "27.5\"", "29\"", "Mullet (29/27.5)"]
    private let travelRanges = ["Hardtail", "100-120mm", "130-140mm", "150-160mm", "160-180mm"]
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
    private var brands: [String] { Array(Set(filterStore.catalog.map(\.brand))).sorted() }
    private var activeProfile: RiderProfile? { profiles.first(where: { $0.isActive }) }
    private var profileFormIsValid: Bool {
        !profileName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && (100...220).contains(Int(profileHeightText) ?? 0)
            && (20...150).contains(Int(profileWeightText) ?? 0)
            && (profileAgeText.isEmpty || (5...100).contains(Int(profileAgeText) ?? 0))
    }

    private enum Field: Hashable {
        case name, age, height, weight, budget
    }

    private enum EbikeMode: String, CaseIterable {
        case any = "Any"
        case ebikeOnly = "eBike only"
    }

    private enum SearchPreset: String, CaseIterable, Identifiable {
        case trailBudget = "Trail Under $3k"
        case gravity = "Gravity Ready"
        case ebike = "All eBikes"
        case kids24 = "Kids 24\""

        var id: String { rawValue }
    }

    private var savedSearches: [SavedSearch] {
        guard let data = savedSearchesData.data(using: .utf8),
              let decoded = try? JSONDecoder().decode([SavedSearch].self, from: data) else {
            return []
        }
        return decoded
    }
    private var forYouTopPicks: [(bike: Bike, score: Int)] {
        guard let profile = activeProfile else { return [] }
        var s = FilterState()
        s.tailorToProfile = true
        s.profileCategoryHint = profile.preferredCategory == "Any" ? nil : profile.preferredCategory
        s.profileStyleHint = profile.style
        s.profileBudgetCap = profile.budgetCap > 0 ? profile.budgetCap : nil
        let inStock = filterStore.catalog.filter { !$0.inStock.isEmpty }
        return Array(BikeFilterEngine.rank(bikes: inStock, filters: s).prefix(5))
    }

    private var isProfileTailoringLocked: Bool {
        filterStore.state.tailorToProfile && activeProfile != nil
    }
    private var currentSearchFingerprint: String {
        [
            filterStore.state.searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
            filterStore.state.category,
            filterStore.state.wheel,
            filterStore.state.maxBudget.map { String(Int($0)) } ?? "",
            Array(filterStore.state.activeBrands).sorted().joined(separator: "|"),
            Array(filterStore.state.activeTravelRanges).sorted().joined(separator: "|"),
            ebikeMode.rawValue
        ].joined(separator: "||")
    }
    private var shouldShowOpenResultsButton: Bool {
        filterStore.filteredBikes.isEmpty == false
            && currentSearchFingerprint != lastSearchFingerprint
            && appState.activeTab != .results
    }

    private var ebikeMode: EbikeMode {
        get {
            return filterStore.state.activeEbikeFilter ? .ebikeOnly : .any
        }
        nonmutating set {
            switch newValue {
            case .any:
                filterStore.state.activeEbikeFilter = false
                filterStore.state.activeEbikeBrandFilters.removeAll()
            case .ebikeOnly:
                filterStore.state.activeEbikeFilter = true
                filterStore.state.activeEbikeBrandFilters.removeAll()
            }
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    welcomeHero
                    catalogStatusBanner
                    statsRow

                    sectionCard("Rider Profile") {
                        if let profile = activeProfile {
                            HStack(spacing: 10) {
                                avatarView(data: profile.avatarData)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(profile.name).font(.headline)
                                    Text("\(profile.experience) · \(profile.style) · \(profile.heightCm)cm/\(profile.weightKg)kg")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Button("Active") {}
                                    .buttonStyle(.borderedProminent)
                                    .tint(Color.rOrange)
                            }
                            .padding(.bottom, 4)

                            Button(role: .destructive) {
                                showClearProfileConfirmation = true
                            } label: {
                                Text("Clear Current Profile")
                            }
                            .buttonStyle(.bordered)
                        }

                        ForEach(profiles.filter { !$0.isActive }) { profile in
                            HStack(spacing: 10) {
                                avatarView(data: profile.avatarData)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(profile.name).font(.subheadline.weight(.semibold))
                                    Text("\(profile.experience) · \(profile.style) · \(profile.preferredCategory)")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Button(profile.isActive ? "Selected" : "Select") {
                                    activateProfile(profile)
                                }
                                .buttonStyle(.bordered)
                                Button(role: .destructive) {
                                    profilePendingDeletion = profile
                                } label: { Text("Delete") }
                                .buttonStyle(.borderless)
                            }
                        }

                        Divider().padding(.vertical, 6)

                        Text("Create or update your rider profile for smarter matching.")
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        VStack(alignment: .leading, spacing: 8) {
                            Text("Profile name").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                            TextField("e.g. Trail Weekend Setup", text: $profileName)
                                .textFieldStyle(.roundedBorder)
                                .focused($focusedField, equals: .name)
                        }

                        VStack(alignment: .leading, spacing: 8) {
                            Text("Body metrics").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                            HStack(spacing: 8) {
                                TextField("Age", text: $profileAgeText)
                                    .focused($focusedField, equals: .age)
                                TextField("Height cm", text: $profileHeightText)
                                    .focused($focusedField, equals: .height)
                            }
                            .textFieldStyle(.roundedBorder)
                            .keyboardType(.numberPad)
                            TextField("Weight kg", text: $profileWeightText)
                                .textFieldStyle(.roundedBorder)
                                .keyboardType(.numberPad)
                                .focused($focusedField, equals: .weight)
                        }

                        VStack(alignment: .leading, spacing: 8) {
                            Text("Riding setup").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                            VStack(alignment: .leading, spacing: 5) {
                                Text("Experience").font(.caption2).foregroundStyle(.secondary)
                                Menu {
                                    ForEach(experiences, id: \.self) { option in
                                        Button {
                                            profileExperience = option
                                        } label: {
                                            Label(option, systemImage: option == profileExperience ? "checkmark.circle.fill" : "circle")
                                        }
                                    }
                                } label: {
                                    profileSelectionField(title: profileExperience, subtitle: "Current rider confidence level")
                                }
                            }
                            VStack(alignment: .leading, spacing: 5) {
                                Text("Riding style").font(.caption2).foregroundStyle(.secondary)
                                Menu {
                                    ForEach(styles, id: \.self) { option in
                                        Button {
                                            profileStyle = option
                                        } label: {
                                            Label(option, systemImage: option == profileStyle ? "checkmark.circle.fill" : "circle")
                                        }
                                    }
                                } label: {
                                    profileSelectionField(title: profileStyle, subtitle: profileStyleSummary(profileStyle))
                                }
                            }

                            HStack(alignment: .center, spacing: 6) {
                                Image(systemName: "info.circle.fill")
                                    .foregroundStyle(Color.rOrange)
                                    .font(.caption)
                                Text("Style auto-maps to category: Trail, Enduro, XC, or Hardtail.")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(2)
                            }

                            TextField("Budget cap", text: $profileBudgetText)
                                .textFieldStyle(.roundedBorder)
                                .keyboardType(.numberPad)
                                .focused($focusedField, equals: .budget)
                        }

                        PhotosPicker("Upload profile image", selection: $selectedPhotoItem, matching: .images)
                            .buttonStyle(.bordered)
                        if let profileAvatarData {
                            HStack(spacing: 8) {
                                avatarView(data: profileAvatarData)
                                Text(photoUploadStatus ?? "Image ready")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        } else if let photoUploadStatus {
                            Text(photoUploadStatus)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

                        Button(activeProfile == nil ? "Create Profile" : "Update Profile") {
                            upsertProfile()
                        }
                            .buttonStyle(.borderedProminent)
                            .tint(Color.rOrange)
                            .disabled(!profileFormIsValid)
                    }

                    sectionCard("Find Your Bike") {
                        VStack(spacing: 12) {
                            Text("1) Start with a quick mode")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)

                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack {
                                    ForEach(SearchPreset.allCases) { preset in
                                        Button(preset.rawValue) { applyPreset(preset) }
                                            .buttonStyle(.bordered)
                                            .tint(Color.rOrange)
                                            .disabled(isProfileTailoringLocked)
                                    }
                                }
                            }

                            if !savedSearches.isEmpty {
                                ScrollView(.horizontal, showsIndicators: false) {
                                    HStack {
                                        ForEach(savedSearches) { saved in
                                            HStack(spacing: 6) {
                                                Button(saved.name) { applySavedSearch(saved) }
                                                    .buttonStyle(.bordered)
                                                Button {
                                                    deleteSavedSearch(saved.id)
                                                } label: {
                                                    Image(systemName: "xmark.circle.fill")
                                                }
                                                .accessibilityLabel("Delete saved search \(saved.name)")
                                                .foregroundStyle(.secondary)
                                            }
                                        }
                                    }
                                }
                            }

                            Text("2) Set main filters")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)

                            Toggle("Use active profile defaults", isOn: Binding(
                                get: { filterStore.state.tailorToProfile },
                                set: { enabled in
                                    filterStore.state.tailorToProfile = enabled
                                    if enabled {
                                        applyProfileHintsFromActive()
                                    } else {
                                        clearProfileHints()
                                    }
                                }
                            ))
                            if isProfileTailoringLocked, let activeProfile {
                                Text("Using profile defaults: \(activeProfile.style) style, \(activeProfile.preferredCategory) category\(activeProfile.budgetCap > 0 ? ", budget $\(Int(activeProfile.budgetCap))" : "").")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }

                            TextField("Bike model or brand", text: Binding(
                                get: { filterStore.state.searchText },
                                set: { filterStore.state.searchText = $0 }
                            ))
                            .textFieldStyle(.roundedBorder)

                            HStack(spacing: 10) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Category")
                                        .font(.caption2.weight(.semibold))
                                        .foregroundStyle(.secondary)
                                    Picker("Category", selection: Binding(
                                        get: { filterStore.state.category },
                                        set: { filterStore.state.category = $0 }
                                    )) { ForEach(categories, id: \.self, content: Text.init) }
                                    .disabled(isProfileTailoringLocked)
                                }
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Wheel")
                                        .font(.caption2.weight(.semibold))
                                        .foregroundStyle(.secondary)
                                    Picker("Wheel", selection: Binding(
                                        get: { filterStore.state.wheel },
                                        set: { filterStore.state.wheel = $0 }
                                    )) { ForEach(wheels, id: \.self, content: Text.init) }
                                }
                            }
                            .font(.caption)

                            TextField("Max budget (AUD)", text: $maxBudgetText)
                                .textFieldStyle(.roundedBorder)
                                .keyboardType(.numberPad)
                                .disabled(isProfileTailoringLocked && (activeProfile?.budgetCap ?? 0) > 0)
                                .onChange(of: maxBudgetText) { _, newValue in
                                    let digits = newValue.filter(\.isNumber)
                                    if digits != newValue { maxBudgetText = digits }
                                    filterStore.state.maxBudget = Double(digits)
                                }

                            VStack(alignment: .leading, spacing: 6) {
                                Text("eBike")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.secondary)
                                Picker("eBike mode", selection: Binding(
                                    get: { ebikeMode },
                                    set: { ebikeMode = $0 }
                                )) {
                                    ForEach(EbikeMode.allCases, id: \.self) { mode in
                                        Text(mode.rawValue).tag(mode)
                                    }
                                }
                                .pickerStyle(.segmented)
                            }

                            DisclosureGroup(isExpanded: $showAdvancedFilters) {
                                VStack(alignment: .leading, spacing: 10) {
                                    VStack(alignment: .leading, spacing: 6) {
                                        HStack {
                                            Text("Brands")
                                                .font(.caption.weight(.semibold))
                                                .foregroundStyle(.secondary)
                                            Spacer()
                                            Menu {
                                                ForEach(brands, id: \.self) { brand in
                                                    Button {
                                                        if filterStore.state.activeBrands.contains(brand) {
                                                            filterStore.state.activeBrands.remove(brand)
                                                        } else {
                                                            filterStore.state.activeBrands.insert(brand)
                                                        }
                                                    } label: {
                                                        Label(
                                                            brand,
                                                            systemImage: filterStore.state.activeBrands.contains(brand) ? "checkmark.circle.fill" : "circle"
                                                        )
                                                    }
                                                }
                                            } label: {
                                                Text(filterStore.state.activeBrands.isEmpty ? "All brands" : "\(filterStore.state.activeBrands.count) selected")
                                                    .font(.caption.weight(.semibold))
                                            }
                                        }
                                        if !filterStore.state.activeBrands.isEmpty {
                                            ScrollView(.horizontal, showsIndicators: false) {
                                                HStack {
                                                    ForEach(Array(filterStore.state.activeBrands).sorted(), id: \.self) { brand in
                                                        ChipButton(title: brand, isActive: true) {
                                                            filterStore.state.activeBrands.remove(brand)
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }

                                    chipRow(title: "Travel", items: travelRanges, selected: filterStore.state.activeTravelRanges) { range in
                                        if filterStore.state.activeTravelRanges.contains(range) { filterStore.state.activeTravelRanges.remove(range) }
                                        else { filterStore.state.activeTravelRanges.insert(range) }
                                    }
                                }
                            } label: {
                                Text("Advanced filters (brand, travel)")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.secondary)
                            }

                            Text("3) Search")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)

                            Button(filterStore.isLiveSearching ? "Searching..." : "Search Bikes Live") {
                                Task { await performLiveSearch() }
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(Color.rOrange)
                            .disabled(filterStore.isLiveSearching)
                            .frame(maxWidth: .infinity, alignment: .leading)

                            HStack {
                                Button(savedSearchFlash ? "Saved!" : "Save Search") {
                                    saveCurrentSearch()
                                    savedSearchFlash = true
                                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                                        savedSearchFlash = false
                                    }
                                }
                                    .buttonStyle(.plain)
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(savedSearchFlash ? Color.rGreen : .secondary)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                    .background(Color.rBackground.opacity(0.75))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 10)
                                            .stroke(savedSearchFlash ? Color.rGreen : Color.rBorder, lineWidth: 1)
                                    )
                                    .clipShape(RoundedRectangle(cornerRadius: 10))
                                    .animation(.easeInOut(duration: 0.2), value: savedSearchFlash)
                                Button("Reset Filters") {
                                    filterStore.state = .init()
                                    maxBudgetText = ""
                                    applyProfileHintsFromActive()
                                }
                                .buttonStyle(.plain)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(Color.rBackground.opacity(0.75))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .stroke(Color.rBorder, lineWidth: 1)
                                )
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                                Spacer()
                                if shouldShowOpenResultsButton {
                                    Button("Open Results") {
                                        appState.activeTab = .results
                                    }
                                    .buttonStyle(.bordered)
                                }
                            }

                            Text("Tip: start with a preset, adjust category + budget, then tap Search Bikes.")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }

                    sectionCard("Ready To Explore") {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Current Matches")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.secondary)
                                Text("\(filterStore.filteredBikes.count) bikes found")
                                    .font(.headline)
                            }
                            Spacer()
                            Button("View Results") {
                                appState.activeTab = .results
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(Color.rOrange)
                        }
                    }

                    if !filterStore.activeFilterTokens.isEmpty {
                        sectionCard("Active Filters") {
                            FlowPills(tokens: filterStore.activeFilterTokens) { token in
                                filterStore.removeToken(token)
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
            }
            .background(Color.rBackground.ignoresSafeArea())
            .navigationTitle("Home")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Done") { focusedField = nil }
                }
            }
            .onAppear {
                maxBudgetText = filterStore.state.maxBudget.map { String(Int($0)) } ?? ""
                applyProfileHintsFromActive()
                if let activeProfile {
                    populateDraft(from: activeProfile)
                }
            }
            .onChange(of: activeProfile?.id) { _, _ in
                if let activeProfile {
                    populateDraft(from: activeProfile)
                } else {
                    clearProfileDraft()
                }
            }
            .onChange(of: selectedPhotoItem) { _, newValue in
                guard let newValue else { return }
                Task {
                    if let data = try? await newValue.loadTransferable(type: Data.self) {
                        await MainActor.run {
                            profileAvatarData = data
                            if let activeProfile {
                                activeProfile.avatarData = data
                                photoUploadStatus = "Updated \(activeProfile.name)'s profile image."
                            } else {
                                photoUploadStatus = "Image selected for new profile."
                            }
                        }
                    } else {
                        await MainActor.run {
                            photoUploadStatus = "Could not read this image. Try another photo."
                        }
                    }
                }
            }
            .alert("Clear current profile?", isPresented: $showClearProfileConfirmation) {
                Button("Cancel", role: .cancel) {}
                Button("Clear", role: .destructive) {
                    clearCurrentProfile()
                }
            } message: {
                Text("This removes your active profile and profile-based defaults from search.")
            }
            .alert(
                "Delete profile?",
                isPresented: Binding(
                    get: { profilePendingDeletion != nil },
                    set: { if !$0 { profilePendingDeletion = nil } }
                ),
                presenting: profilePendingDeletion
            ) { profile in
                Button("Cancel", role: .cancel) {}
                Button("Delete", role: .destructive) {
                    modelContext.delete(profile)
                    profilePendingDeletion = nil
                }
            } message: { profile in
                Text("Delete \(profile.name)? This cannot be undone.")
            }
            .sheet(item: $selectedForYouBike) { bike in
                BikeDetailView(bike: bike)
            }
        }
    }

    private func performLiveSearch() async {
        let criteria = LiveSearchCriteria.from(filterStore.state)

        filterStore.isLiveSearching = true
        filterStore.liveSearchError = nil
        filterStore.liveSearchStatus = "Building search queries..."
        filterStore.liveSearchQueryDescription = searchDescription(for: criteria)

        // Switch to Results immediately so the progress overlay is visible
        appState.activeTab = .results

        // Advance status labels in the background to reflect the real pipeline stages
        let stageTask = Task<Void, Never> {
            let stages: [(nanoseconds: UInt64, message: String)] = [
                (2_000_000_000,  "Searching AU retailers..."),
                (6_000_000_000,  "AI extracting specs and prices..."),
                (18_000_000_000, "Fetching bike photos..."),
                (14_000_000_000, "Almost done..."),
            ]
            for stage in stages {
                try? await Task.sleep(nanoseconds: stage.nanoseconds)
                guard !Task.isCancelled else { return }
                filterStore.liveSearchStatus = stage.message
            }
        }

        defer {
            stageTask.cancel()
            filterStore.isLiveSearching = false
            filterStore.liveSearchStatus = ""
        }

        do {
            let result = try await LiveSearchService.shared.search(criteria: criteria)
            filterStore.liveResults = result.bikes
            filterStore.liveResultSource = "Live · \(result.count) bikes from web"
            lastSearchFingerprint = currentSearchFingerprint
        } catch {
            filterStore.liveSearchError = error.localizedDescription
            lastSearchFingerprint = currentSearchFingerprint
        }
    }

    private func searchDescription(for criteria: LiveSearchCriteria) -> String {
        var parts: [String] = []
        if let cat = criteria.category { parts.append(cat) }
        else if criteria.ebike { parts.append("eBikes") }
        else { parts.append("Mountain bikes") }
        if !criteria.brands.isEmpty { parts.append(criteria.brands.prefix(2).joined(separator: " & ")) }
        if let wheel = criteria.wheel { parts.append(wheel) }
        if let budget = criteria.budget { parts.append("under $\(Int(budget))") }
        parts.append("in Australia")
        return parts.joined(separator: " · ")
    }

    private func applyPreset(_ preset: SearchPreset) {
        switch preset {
        case .trailBudget:
            filterStore.state.category = "Trail"
            filterStore.state.activeTravelRanges = ["130-140mm", "150-160mm"]
            maxBudgetText = "3000"
            filterStore.state.maxBudget = 3000
            ebikeMode = .any
        case .gravity:
            filterStore.state.category = "Enduro"
            filterStore.state.activeTravelRanges = ["160-180mm"]
            ebikeMode = .any
        case .ebike:
            ebikeMode = .ebikeOnly
            filterStore.state.category = "Any"
            filterStore.state.activeTravelRanges.removeAll()
        case .kids24:
            filterStore.state.wheel = "24\""
            filterStore.state.category = "Any"
            filterStore.state.activeTravelRanges = ["Hardtail"]
            maxBudgetText = "1200"
            filterStore.state.maxBudget = 1200
            ebikeMode = .any
        }
    }

    private func saveCurrentSearch() {
        let snapshot = SavedSearch(
            id: UUID(),
            name: searchNameForCurrentState(),
            searchText: filterStore.state.searchText,
            category: filterStore.state.category,
            wheel: filterStore.state.wheel,
            maxBudget: filterStore.state.maxBudget,
            activeBrands: Array(filterStore.state.activeBrands).sorted(),
            activeTravelRanges: Array(filterStore.state.activeTravelRanges).sorted(),
            ebikeMode: ebikeMode.rawValue
        )
        var current = savedSearches
        current.insert(snapshot, at: 0)
        persistSavedSearches(Array(current.prefix(8)))
    }

    private func searchNameForCurrentState() -> String {
        if !filterStore.state.searchText.isEmpty { return filterStore.state.searchText }
        if filterStore.state.category != "Any" { return filterStore.state.category }
        if let budget = filterStore.state.maxBudget { return "Under \(Int(budget))" }
        return "My Search"
    }

    private func applySavedSearch(_ saved: SavedSearch) {
        filterStore.state.searchText = saved.searchText
        filterStore.state.category = saved.category
        filterStore.state.wheel = saved.wheel
        filterStore.state.maxBudget = saved.maxBudget
        maxBudgetText = saved.maxBudget.map { String(Int($0)) } ?? ""
        filterStore.state.activeBrands = Set(saved.activeBrands)
        filterStore.state.activeTravelRanges = Set(saved.activeTravelRanges)
        if saved.ebikeMode == "DJI Avinox" {
            ebikeMode = .ebikeOnly
        } else {
            ebikeMode = EbikeMode(rawValue: saved.ebikeMode) ?? .any
        }
    }

    private func deleteSavedSearch(_ id: UUID) {
        persistSavedSearches(savedSearches.filter { $0.id != id })
    }

    private func persistSavedSearches(_ searches: [SavedSearch]) {
        guard let data = try? JSONEncoder().encode(searches),
              let text = String(data: data, encoding: .utf8) else { return }
        savedSearchesData = text
    }

    private func createProfile() {
        guard !profileName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        let age = Int(profileAgeText) ?? 0
        let height = Int(profileHeightText) ?? 0
        let weight = Int(profileWeightText) ?? 0
        let budget = Double(profileBudgetText) ?? 0
        let profile = RiderProfile(
            name: profileName,
            age: age,
            heightCm: height,
            weightKg: weight,
            experience: profileExperience,
            style: profileStyle,
            preferredCategory: inferredCategory(for: profileStyle),
            budgetCap: budget,
            avatarData: profileAvatarData
        )
        if profiles.isEmpty { profile.isActive = true }
        modelContext.insert(profile)
        clearProfileDraft()
        applyProfileHintsFromActive()
    }

    private func upsertProfile() {
        if let activeProfile {
            activeProfile.name = profileName
            activeProfile.age = Int(profileAgeText) ?? 0
            activeProfile.heightCm = Int(profileHeightText) ?? 0
            activeProfile.weightKg = Int(profileWeightText) ?? 0
            activeProfile.experience = profileExperience
            activeProfile.style = profileStyle
            activeProfile.preferredCategory = inferredCategory(for: profileStyle)
            activeProfile.budgetCap = Double(profileBudgetText) ?? 0
            if let profileAvatarData {
                activeProfile.avatarData = profileAvatarData
            }
            photoUploadStatus = "Updated \(activeProfile.name)'s profile settings."
            applyProfileHints(activeProfile)
        } else {
            createProfile()
        }
    }

    private func activateProfile(_ profile: RiderProfile) {
        for p in profiles { p.isActive = false }
        profile.isActive = true
        applyProfileHints(profile)
    }

    private func applyProfileHintsFromActive() {
        guard let profile = profiles.first(where: { $0.isActive }) else { return }
        applyProfileHints(profile)
    }

    private func applyProfileHints(_ profile: RiderProfile) {
        filterStore.state.tailorToProfile = true
        let inferredCategory = inferredCategory(for: profile.style)
        filterStore.state.profileCategoryHint = inferredCategory == "Any" ? nil : inferredCategory
        filterStore.state.profileStyleHint = profile.style
        filterStore.state.profileHeightCm = profile.heightCm > 0 ? profile.heightCm : nil
        filterStore.state.profileBudgetCap = profile.budgetCap > 0 ? profile.budgetCap : nil
        if inferredCategory != "Any" {
            filterStore.state.category = inferredCategory
        }
        if profile.budgetCap > 0 {
            filterStore.state.maxBudget = profile.budgetCap
            maxBudgetText = String(Int(profile.budgetCap))
        }
    }

    private func clearCurrentProfile() {
        guard let activeProfile else { return }
        modelContext.delete(activeProfile)
        clearProfileHints()
        filterStore.state.tailorToProfile = false
        clearProfileDraft()
        maxBudgetText = filterStore.state.maxBudget.map { String(Int($0)) } ?? ""
        photoUploadStatus = "Current profile cleared."
    }

    private func clearProfileHints() {
        filterStore.state.profileCategoryHint = nil
        filterStore.state.profileStyleHint = nil
        filterStore.state.profileHeightCm = nil
        filterStore.state.profileBudgetCap = nil
    }

    private func populateDraft(from profile: RiderProfile) {
        profileName = profile.name
        profileAgeText = profile.age > 0 ? String(profile.age) : ""
        profileHeightText = profile.heightCm > 0 ? String(profile.heightCm) : ""
        profileWeightText = profile.weightKg > 0 ? String(profile.weightKg) : ""
        profileBudgetText = profile.budgetCap > 0 ? String(Int(profile.budgetCap)) : ""
        profileExperience = profile.experience
        profileStyle = profile.style
        profileCategory = inferredCategory(for: profile.style)
        profileAvatarData = profile.avatarData
    }

    private func inferredCategory(for style: String) -> String {
        let normalized = style.lowercased()
        switch normalized {
        case "trail", "all-mountain", "all mountain":
            return "Trail"
        case "enduro", "downhill", "freeride", "gravity":
            return "Enduro"
        case "cross-country", "cross country", "xc":
            return "XC / Cross-Country"
        case "dirt jump / pump track", "dirt jump", "pump track", "slopestyle":
            return "Hardtail"
        default:
            return "Any"
        }
    }

    private func clearProfileDraft() {
        profileName = ""
        profileAgeText = ""
        profileHeightText = ""
        profileWeightText = ""
        profileBudgetText = ""
        profileExperience = "Beginner"
        profileStyle = "Trail"
        profileCategory = "Any"
        selectedPhotoItem = nil
        profileAvatarData = nil
        photoUploadStatus = nil
    }

    private func profileSelectionField(title: String, subtitle: String) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                Text(subtitle)
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
        .padding(.vertical, 9)
        .background(Color.rBackground.opacity(0.65))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func profileStyleSummary(_ style: String) -> String {
        switch RidingDisciplineKind.from(style) {
        case .trail:
            return "Balanced all-round riding focus"
        case .gravity:
            return "Steep descending and technical terrain"
        case .crossCountry:
            return "Fast climbing and efficiency"
        case .jump:
            return "Pump track and jump handling"
        case .other:
            return "General mountain bike riding"
        }
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
        .frame(width: 36, height: 36)
        .clipShape(Circle())
    }

    private var statsRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                statCard("Bikes Found", "\(filterStore.filteredBikes.count)") {
                    appState.activeTab = .results
                }
                statCard("Best Price", Formatting.currency(filterStore.filteredBikes.compactMap(\.bestPrice).min())) {
                    appState.activeTab = .results
                }
                statCard("Retailers", "\(RETAILERS.count)") {
                    appState.activeTab = .results
                }
                statCard("Price Alerts", "0") {
                    appState.activeTab = .results
                }
            }
        }
    }

    private var catalogStatusBanner: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(catalogStore.sourceStatus == "Live source" ? Color.rGreen : Color.rOrange)
                .frame(width: 8, height: 8)
            Text(catalogStore.sourceStatus)
                .font(.caption.weight(.semibold))
            if let fallbackReason = catalogStore.fallbackReason, !fallbackReason.isEmpty {
                Text("· \(fallbackReason)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.rCard)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    @ViewBuilder
    private var welcomeHero: some View {
        if let profile = activeProfile, !forYouTopPicks.isEmpty {
            // "For You" personalised showcase
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Hey \(profile.name.components(separatedBy: " ").first ?? profile.name)!")
                            .font(.title3.weight(.bold))
                        Text("Your top picks · \(profile.style)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button {
                        appState.activeTab = .results
                    } label: {
                        Text("See all")
                            .font(.caption.weight(.semibold))
                        Image(systemName: "chevron.right")
                            .font(.caption2.weight(.semibold))
                    }
                    .foregroundStyle(Color.rOrange)
                }

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(forYouTopPicks, id: \.bike.id) { row in
                            Button {
                                selectedForYouBike = row.bike
                            } label: {
                                forYouBikeCard(bike: row.bike, score: row.score)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
            .padding(14)
            .background(
                LinearGradient(
                    colors: [Color.rCard, Color.rOrangeLight],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.rBorder, lineWidth: 1))
        } else {
            // No profile yet — call to action
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Find your perfect mountain bike")
                            .font(.title3.weight(.bold))
                        Text("Build your profile to get matched picks, sizing, budget planning, and trip advice.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Image(systemName: "mountain.2.fill")
                        .font(.title2.weight(.bold))
                        .foregroundStyle(Color.rOrange)
                }
            }
            .padding(14)
            .background(
                LinearGradient(
                    colors: [Color.rCard, Color.rOrangeLight],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.rBorder, lineWidth: 1))
        }
    }

    private func forYouBikeCard(bike: Bike, score: Int) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            // Image
            Group {
                if let url = bike.effectiveImageURL {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let img):
                            img.resizable().scaledToFill()
                        default:
                            bikePlaceholder
                        }
                    }
                } else {
                    bikePlaceholder
                }
            }
            .frame(width: 130, height: 90)
            .clipped()
            .background(Color.rCard)

            // Info
            VStack(alignment: .leading, spacing: 3) {
                Text(bike.brand.uppercased())
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                Text(bike.model)
                    .font(.caption.weight(.semibold))
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 4) {
                    Text(Formatting.currency(bike.bestPrice))
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(Color.rGreen)
                    Spacer()
                    Text("\(score)%")
                        .font(.system(size: 9, weight: .bold))
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(Color.rOrangeLight)
                        .foregroundStyle(Color.rOrangeDark)
                        .clipShape(Capsule())
                }
            }
            .padding(8)
        }
        .frame(width: 130)
        .background(Color.rCard)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.rBorder, lineWidth: 1))
    }

    private var bikePlaceholder: some View {
        ZStack {
            Color.rOrangeLight
            Image(systemName: "bicycle")
                .font(.title2)
                .foregroundStyle(Color.rOrange.opacity(0.6))
        }
    }

    private func statCard(_ title: String, _ value: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 6) {
                Text(value).font(.title3.weight(.bold))
                Text(title).font(.caption).foregroundStyle(.secondary)
            }
            .frame(width: 170, alignment: .leading)
            .padding(12)
            .background(Color.rCard)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
    }

    private func sectionCard<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        sectionBody(title: title, content: content)
            .padding(12)
            .background(Color.rCard)
            .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private func sectionBody<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title.uppercased())
                .font(.caption.weight(.bold))
                .foregroundStyle(Color.rOrange)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func chipRow(
        title: String,
        items: [String],
        selected: Set<String>,
        onTap: @escaping (String) -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack {
                    ForEach(items, id: \.self) { item in
                        ChipButton(title: item, isActive: selected.contains(item)) {
                            onTap(item)
                        }
                    }
                }
            }
        }
    }
}

private struct SavedSearch: Identifiable, Codable {
    let id: UUID
    let name: String
    let searchText: String
    let category: String
    let wheel: String
    let maxBudget: Double?
    let activeBrands: [String]
    let activeTravelRanges: [String]
    let ebikeMode: String
}

private struct FlowPills: View {
    let tokens: [FilterStore.ActiveFilterToken]
    let remove: (FilterStore.ActiveFilterToken) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(tokens) { token in
                HStack {
                    Text(token.label)
                        .font(.caption)
                        .foregroundStyle(Color.rChipForeground)
                    Spacer()
                    Button("✕") { remove(token) }
                        .font(.caption)
                        .foregroundStyle(Color.rChipForeground)
                }
                .padding(8)
                .background(Color.rOrangeLight)
                .clipShape(Capsule())
            }
        }
    }
}

private struct ChipButton: View {
    let title: String
    let isActive: Bool
    let action: () -> Void

    var body: some View {
        Button(title, action: action)
            .buttonStyle(.plain)
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(isActive ? Color.rOrangeLight : Color.rCard)
            .foregroundStyle(isActive ? Color.rChipForeground : Color.primary)
            .overlay(
                Capsule().stroke(isActive ? Color.rOrange : Color.rBorder, lineWidth: 1)
            )
            .clipShape(Capsule())
    }
}
