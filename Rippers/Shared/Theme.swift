import SwiftUI

public extension Color {
    static let rOrange = Color(hex: "#E5470A")
    static let rOrangeDark = Color(hex: "#C63C07")
    static let rOrangeLight = Color.dynamic(light: Color(hex: "#FDF1EC"), dark: Color(hex: "#4A2C21"))
    static let rBackground = Color.dynamic(light: Color(hex: "#F0ECE4"), dark: Color(hex: "#111316"))
    static let rCard = Color.dynamic(light: .white, dark: Color(hex: "#1B1E22"))
    static let rBorder = Color.dynamic(light: Color(hex: "#E8E3DB"), dark: Color(hex: "#3A3F46"))
    static let rTextMuted = Color(hex: "#888888")
    static let rTextLabel = Color(hex: "#666666")
    static let rGreen = Color(hex: "#2EA84C")
    static let rGreenBg = Color.dynamic(light: Color(hex: "#EAFAF0"), dark: Color(hex: "#163326"))
    static let rRed = Color(hex: "#DC3545")
    static let rRedBg = Color.dynamic(light: Color(hex: "#FDECEA"), dark: Color(hex: "#3D1F24"))
    static let rYellow = Color(hex: "#F59E0B")
    static let rYellowBg = Color.dynamic(light: Color(hex: "#FFF8E1"), dark: Color(hex: "#3D3520"))
    static let rBlue = Color(hex: "#2563EB")
    static let rBlueBg = Color.dynamic(light: Color(hex: "#EFF6FF"), dark: Color(hex: "#1A2E46"))
}

public extension Color {
    static func dynamic(light: Color, dark: Color) -> Color {
        #if canImport(UIKit)
        return Color(UIColor { trait in
            trait.userInterfaceStyle == .dark ? UIColor(dark) : UIColor(light)
        })
        #else
        return light
        #endif
    }

    init(hex: String) {
        let sanitized = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var value: UInt64 = 0
        Scanner(string: sanitized).scanHexInt64(&value)
        let a, r, g, b: UInt64
        switch sanitized.count {
        case 8:
            (a, r, g, b) = (value >> 24, value >> 16 & 0xff, value >> 8 & 0xff, value & 0xff)
        case 6:
            (a, r, g, b) = (255, value >> 16, value >> 8 & 0xff, value & 0xff)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
