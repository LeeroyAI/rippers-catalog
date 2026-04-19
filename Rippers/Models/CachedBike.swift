import Foundation
import SwiftData

// Persistent store for live-searched bike results.
// profileTag == "" means seed data (shared across all profiles).
// profileTag == UUID string means data fetched for that specific profile.
@Model
final class CachedBike {
    var bikeId: Int
    var profileTag: String
    var fetchedAt: Date
    var recordData: Data    // JSON-encoded BikeRecord

    init(record: BikeRecord, profileTag: String, fetchedAt: Date = .now) {
        self.bikeId = record.id
        self.profileTag = profileTag
        self.fetchedAt = fetchedAt
        self.recordData = (try? JSONEncoder().encode(record)) ?? Data()
    }

    var bike: Bike? {
        (try? JSONDecoder().decode(BikeRecord.self, from: recordData))?.bike
    }
}
