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
        let trimmedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedQuery.isEmpty else { return nil }
        let encodedQuery = trimmedQuery

        var components = URLComponents()
        components.scheme = "https"
        components.host = domain

        switch id {
        case "99bikes", "pushys":
            components.path = "/search"
            components.queryItems = [URLQueryItem(name: "query", value: encodedQuery)]
        case "bikebug":
            components.path = "/catalogsearch/result/"
            components.queryItems = [URLQueryItem(name: "q", value: encodedQuery)]
        case "probikekit":
            components.path = "/search/"
            components.queryItems = [URLQueryItem(name: "search", value: encodedQuery)]
        case "crc":
            components.path = "/search"
            components.queryItems = [URLQueryItem(name: "keyword", value: encodedQuery)]
        case "torpedo7", "anaconda":
            components.path = "/search"
            components.queryItems = [URLQueryItem(name: "text", value: encodedQuery)]
        case "specialized", "trek", "commencal":
            components.path = "/au/en/search"
            components.queryItems = [URLQueryItem(name: "q", value: encodedQuery)]
        case "giant":
            components.path = "/en-au/search"
            components.queryItems = [URLQueryItem(name: "keyword", value: encodedQuery)]
        case "canyon":
            components.path = "/en-au/search"
            components.queryItems = [URLQueryItem(name: "searchTerm", value: encodedQuery)]
        case "cyclingexpress", "bicycleonline", "bikesonline":
            components.path = "/search"
            components.queryItems = [
                URLQueryItem(name: "type", value: "product"),
                URLQueryItem(name: "q", value: encodedQuery)
            ]
        case "bicycleexpress":
            components.path = "/search"
            components.queryItems = [URLQueryItem(name: "q", value: encodedQuery)]
        case "bicyclesuperstore", "dutchcargo", "empirecycles":
            components.path = "/search"
            components.queryItems = [URLQueryItem(name: "q", value: encodedQuery)]
        default:
            components.path = "/search"
            components.queryItems = [URLQueryItem(name: "q", value: encodedQuery)]
        }

        return components.url
    }

    /// Returns a verified product page URL for this retailer, or nil if none exists.
    /// Only returns URLs that point directly to the bike's product page on this retailer's site.
    public func directURL(for bike: Bike) -> URL? {
        // 1. Per-retailer URL extracted by the search pipeline (most reliable)
        if let raw = bike.retailerUrls[id], let url = URL(string: raw) {
            return url
        }
        // 2. sourceUrl domain match (one retailer gets this per live result)
        guard let url = URL(string: bike.sourceUrl),
              let host = url.host?.lowercased() else { return nil }
        let canonicalHost = domain.lowercased()
        if host == canonicalHost || host.hasSuffix(".\(canonicalHost)") || canonicalHost.hasSuffix(host) {
            return url
        }
        return nil
    }

    /// Returns the best available URL: direct product page if verified, search page otherwise.
    public func dealURL(for bike: Bike) -> URL? {
        directURL(for: bike) ?? searchURL(for: bike.searchQuery)
    }

    /// True when we have a verified direct product page URL for this bike on this retailer.
    public func hasVerifiedURL(for bike: Bike) -> Bool {
        directURL(for: bike) != nil
    }
}

private extension Bike {
    var searchQuery: String {
        "\(brand) \(model) \(year)"
    }
}
