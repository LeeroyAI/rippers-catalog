import Foundation

public enum Formatting {
    public static let audCurrency: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.locale = Locale(identifier: "en_AU")
        formatter.maximumFractionDigits = 0
        return formatter
    }()

    public static func currency(_ value: Double?) -> String {
        guard let value else { return "N/A" }
        return audCurrency.string(from: NSNumber(value: value)) ?? "$0"
    }
}
