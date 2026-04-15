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

private struct AppIconBadge: View {
    var body: some View {
        Group {
            if let icon = UIImage.appIconImage {
                Image(uiImage: icon)
                    .resizable()
                    .interpolation(.high)
                    .scaledToFill()
            } else {
                RoundedRectangle(cornerRadius: 7)
                    .fill(Color.rOrangeLight)
                    .overlay(
                        Image(systemName: "mountain.2.fill")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(Color.rOrange)
                    )
            }
        }
        .frame(width: 22, height: 22)
        .clipShape(RoundedRectangle(cornerRadius: 7))
        .overlay(
            RoundedRectangle(cornerRadius: 7)
                .stroke(Color.rBorder, lineWidth: 0.5)
        )
    }
}

private struct BrandedNavigationTitleModifier: ViewModifier {
    let title: String

    func body(content: Content) -> some View {
        content
            .toolbar {
                ToolbarItem(placement: .principal) {
                    HStack(spacing: 8) {
                        AppIconBadge()
                        Text(title)
                            .font(.headline.weight(.semibold))
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
        guard let icons = Bundle.main.infoDictionary?["CFBundleIcons"] as? [String: Any],
              let primary = icons["CFBundlePrimaryIcon"] as? [String: Any],
              let files = primary["CFBundleIconFiles"] as? [String],
              let iconName = files.last else {
            return nil
        }
        return UIImage(named: iconName)
    }
}
