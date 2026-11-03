import Foundation

/// Paths are display hints only. Reopening requires the retained provider bookmark.
final class RecentDocuments {
    struct Entry: Codable, Equatable, Identifiable {
        let id: String
        let name: String
        let location: String
        let bookmark: Data
    }
    private struct Envelope: Codable {
        let version: Int
        let entries: [Entry]
    }
    static let key = "specdown.recentDocuments.v1"
    private let defaults: UserDefaults
    private var writable = true
    private(set) var entries: [Entry] = []

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        guard let data = defaults.data(forKey: Self.key) else { return }
        guard data.count <= 2 * 1024 * 1024,
              let envelope = try? JSONDecoder().decode(Envelope.self, from: data),
              envelope.version == 1,
              envelope.entries.count <= 20,
              envelope.entries.allSatisfy(Self.valid),
              Set(envelope.entries.map(\.id)).count == envelope.entries.count else {
            // Preserve corrupt/future stores rather than overwriting on downgrade.
            writable = false
            return
        }
        entries = envelope.entries
    }

    private static func valid(_ entry: Entry) -> Bool {
        !entry.id.isEmpty && entry.id.utf8.count <= 128 && !entry.name.isEmpty && entry.name.utf8.count <= 1024 &&
        entry.location.utf8.count <= 4096 && !entry.bookmark.isEmpty && entry.bookmark.count <= 65536
    }

    func record(_ entry: Entry) {
        guard writable, Self.valid(entry) else { return }
        var updated = entries.filter { $0.id != entry.id }
        updated.insert(entry, at: 0)
        updated = Array(updated.prefix(20))
        guard let data = try? JSONEncoder().encode(Envelope(version: 1, entries: updated)), data.count <= 2 * 1024 * 1024 else { return }
        defaults.set(data, forKey: Self.key)
        entries = updated
    }
}
