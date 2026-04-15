import SwiftUI
import UIKit

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
