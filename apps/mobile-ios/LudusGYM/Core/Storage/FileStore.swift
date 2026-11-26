import Foundation

struct CachedQrCredential: Codable {
    let raw: String
    let expiresAtMillis: Int64
    let gymId: String?
    let memberId: String
    let cachedAt: Int64
}

struct PendingOperation: Codable, Identifiable {
    let id: String
    let type: String
    let payload: String
    let createdAt: Int64
    var attempts: Int
}

/// Persistencia ligera de caché y cola offline (equivalente a Room en Android).
/// Los tokens NO se guardan aquí: viven exclusivamente en Keychain.
actor FileStore {
    static let shared = FileStore()

    enum Key {
        static let member = "cached_member"
        static let gyms = "cached_gyms"
        static let activeGym = "active_gym"
        static let routines = "cached_routines"
        static let qrCredential = "qr_credential"
        static let pendingSync = "pending_sync"
        static let bookings = "bookings_offline"
        static let hydration = "hydration_glasses"
        static let theme = "theme"
    }

    private let directory: URL = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return base.appendingPathComponent("LudusGYM", isDirectory: true)
    }()

    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init() {
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    func load<T: Decodable>(_ key: String, as type: T.Type = T.self) -> T? {
        guard let data = try? Data(contentsOf: url(for: key)) else { return nil }
        return try? decoder.decode(T.self, from: data)
    }

    func save<T: Encodable>(_ value: T, key: String) {
        guard let data = try? encoder.encode(value) else { return }
        try? data.write(to: url(for: key), options: .atomic)
    }

    func remove(_ key: String) {
        try? FileManager.default.removeItem(at: url(for: key))
    }

    func clearCachedData() {
        [Key.member, Key.gyms, Key.activeGym, Key.routines, Key.qrCredential,
         Key.pendingSync, Key.bookings, Key.hydration].forEach(remove)
    }

    // MARK: - Cola offline

    func enqueue(type: String, payload: String) {
        var pending = load(Key.pendingSync, as: [PendingOperation].self) ?? []
        pending.append(
            PendingOperation(
                id: UUID().uuidString,
                type: type,
                payload: payload,
                createdAt: QrPayload.nowMillis(),
                attempts: 0
            )
        )
        save(pending, key: Key.pendingSync)
    }

    func pending() -> [PendingOperation] {
        load(Key.pendingSync, as: [PendingOperation].self) ?? []
    }

    func updatePending(_ operations: [PendingOperation]) {
        save(operations, key: Key.pendingSync)
    }

    private func url(for key: String) -> URL {
        directory.appendingPathComponent("\(key).json")
    }
}
