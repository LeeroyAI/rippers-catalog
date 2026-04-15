import Foundation

public enum CatalogSourceType: String, Sendable {
    case officialAPI
    case publicFeed
    case fallbackParser
    case staticFallback
}

public struct CatalogSource: Identifiable, Sendable {
    public let id: String
    public let name: String
    public let type: CatalogSourceType
    public let endpoint: URL?
    public let ttlSeconds: TimeInterval
    public let enabled: Bool

    public init(
        id: String,
        name: String,
        type: CatalogSourceType,
        endpoint: URL?,
        ttlSeconds: TimeInterval,
        enabled: Bool = true
    ) {
        self.id = id
        self.name = name
        self.type = type
        self.endpoint = endpoint
        self.ttlSeconds = ttlSeconds
        self.enabled = enabled
    }
}

public struct CatalogAuditRecord: Identifiable, Sendable {
    public let id: UUID
    public let sourceID: String
    public let bikeID: Int
    public let severity: Severity
    public let message: String
    public let createdAt: Date

    public enum Severity: String, Sendable {
        case info
        case warning
        case critical
    }

    public init(sourceID: String, bikeID: Int, severity: Severity, message: String) {
        self.id = UUID()
        self.sourceID = sourceID
        self.bikeID = bikeID
        self.severity = severity
        self.message = message
        self.createdAt = Date()
    }
}

public struct CatalogFetchPayload: Sendable {
    public let source: CatalogSource
    public let bikes: [Bike]
    public let audits: [CatalogAuditRecord]
    public let fetchedAt: Date

    public init(source: CatalogSource, bikes: [Bike], audits: [CatalogAuditRecord], fetchedAt: Date = .now) {
        self.source = source
        self.bikes = bikes
        self.audits = audits
        self.fetchedAt = fetchedAt
    }
}
