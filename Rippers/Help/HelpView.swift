import SwiftUI

struct HelpView: View {
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    sectionCard("How Rippers Works") {
                        VStack(alignment: .leading, spacing: 10) {
                            guideRow(
                                step: "1",
                                title: "Create your rider profile",
                                body: "Add your height, weight, experience, riding style, and budget."
                            )
                            guideRow(
                                step: "2",
                                title: "Run a tailored search",
                                body: "Use the Home search flow: pick a quick mode, set core filters, then tap Search Bikes."
                            )
                            guideRow(
                                step: "3",
                                title: "Compare and plan",
                                body: "Review results, compare up to 3 bikes, then use Trip Planner for riding areas and shops."
                            )
                        }
                    }

                    sectionCard("Quick Tips") {
                        VStack(alignment: .leading, spacing: 8) {
                            tipRow("Use presets first for faster setup.")
                            tipRow("Keep advanced filters collapsed unless needed.")
                            tipRow("Save searches you use often.")
                            tipRow("Turn on profile defaults for better match quality.")
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
            }
            .background(Color.rBackground.ignoresSafeArea())
            .rippersBrandedTitle("Help")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func sectionCard<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title.uppercased())
                .font(.caption.weight(.bold))
                .foregroundStyle(Color.rOrange)
            content()
        }
        .padding(12)
        .background(Color.rCard)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private func guideRow(step: String, title: String, body: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text(step)
                .font(.caption.weight(.bold))
                .foregroundStyle(.white)
                .frame(width: 22, height: 22)
                .background(Color.rOrange)
                .clipShape(Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.semibold))
                Text(body).font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    private func tipRow(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(Color.rOrange)
                .font(.caption)
            Text(text)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}

