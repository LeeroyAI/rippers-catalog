import SwiftUI
import UIKit

struct RippersCard<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding(BrandSpacing.md)
            .background(BrandColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: BrandRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: BrandRadius.md)
                    .stroke(BrandColor.border, lineWidth: 1)
            )
    }
}

struct RippersButton: View {
    let title: String
    var prominent: Bool = true
    var action: () -> Void

    var body: some View {
        Button(title, action: action)
            .buttonStyle(.plain)
            .padding(.horizontal, BrandSpacing.md)
            .padding(.vertical, BrandSpacing.sm)
            .background(prominent ? BrandColor.primary : BrandColor.surfaceElevated)
            .foregroundStyle(prominent ? Color.white : BrandColor.text)
            .clipShape(Capsule())
    }
}

struct RippersBadge: View {
    let title: String
    var tone: Color = BrandColor.success

    var body: some View {
        Text(title)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(tone.opacity(0.18))
            .foregroundStyle(tone)
            .clipShape(Capsule())
    }
}

struct RippersFilterChip: View {
    let title: String
    let isActive: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 10)
                .padding(.vertical, 7)
                .foregroundStyle(isActive ? Color.white : BrandColor.textMuted)
                .background(isActive ? BrandColor.primary : BrandColor.surfaceElevated)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

struct AppIconBadge: View {
    var size: CGFloat = 22

    var body: some View {
        Group {
            if let appIcon = UIImage.appIconImage {
                Image(uiImage: appIcon)
                    .resizable()
                    .scaledToFill()
            } else {
                Image(systemName: "mountain.2.fill")
                    .resizable()
                    .scaledToFit()
                    .padding(4)
                    .foregroundStyle(Color.rOrange)
                    .background(Color.rOrangeLight)
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .stroke(Color.rBorder, lineWidth: 1)
        )
    }
}

private struct BrandedNavigationTitleModifier: ViewModifier {
    let title: String

    func body(content: Content) -> some View {
        content
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    HStack(spacing: 8) {
                        AppIconBadge()
                        Text(title)
                            .font(.headline)
                            .lineLimit(1)
                    }
                }
            }
    }
}

extension View {
    func rippersBrandedTitle(_ title: String) -> some View {
        modifier(BrandedNavigationTitleModifier(title: title))
    }
}

private extension UIImage {
    static var appIconImage: UIImage? {
        guard
            let icons = Bundle.main.infoDictionary?["CFBundleIcons"] as? [String: Any],
            let primary = icons["CFBundlePrimaryIcon"] as? [String: Any],
            let files = primary["CFBundleIconFiles"] as? [String],
            let lastIcon = files.last
        else {
            return nil
        }
        return UIImage(named: lastIcon)
    }
}
