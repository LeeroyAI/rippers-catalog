import Foundation

public struct Retailer: Identifiable, Hashable, Sendable {
    public let id: String
    public let name: String
    public let color: String
    public let domain: String
    public let isAustralian: Bool
    public let url: String

    public init(id: String, name: String, color: String, domain: String, isAustralian: Bool, url: String) {
        self.id = id
        self.name = name
        self.color = color
        self.domain = domain
        self.isAustralian = isAustralian
        self.url = url
    }

    public func searchURL(for query: String) -> URL? {
        var components = URLComponents()
        components.scheme = "https"
        components.host = domain
        components.path = "/search"
        components.queryItems = [URLQueryItem(name: "q", value: query)]
        return components.url
    }
}
