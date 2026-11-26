import Foundation
import Security

/// Estado de sesión persistido en Keychain. Nunca se guarda en UserDefaults.
struct Session {
    let accessToken: String
    let refreshToken: String
    let memberId: String
    let activeGymId: String?

    var isValid: Bool {
        !accessToken.isEmpty && !refreshToken.isEmpty && !memberId.isEmpty
    }
}

/// Acceso seguro a los cinco valores de sesión.
/// `device_id` se crea una sola vez y NO se borra al cerrar sesión.
enum SecureStore {
    static let accessTokenKey = "access_token"
    static let refreshTokenKey = "refresh_token"
    static let memberIdKey = "member_id"
    static let activeGymIdKey = "active_gym_id"
    static let deviceIdKey = "device_id"

    private static let service = "com.ludus.gym.ios"

    static var accessToken: String? { read(accessTokenKey) }
    static var refreshToken: String? { read(refreshTokenKey) }
    static var memberId: String? { read(memberIdKey) }
    static var activeGymId: String? {
        let value = read(activeGymIdKey) ?? ""
        return value.isEmpty ? nil : value
    }

    static var session: Session? {
        guard
            let access = accessToken, !access.isEmpty,
            let refresh = refreshToken, !refresh.isEmpty,
            let member = memberId, !member.isEmpty
        else { return nil }
        return Session(
            accessToken: access,
            refreshToken: refresh,
            memberId: member,
            activeGymId: activeGymId
        )
    }

    static func hasSession() -> Bool { session != nil }

    /// Guarda el par de tokens. Si `activeGymId` es nil conserva el gimnasio
    /// anterior: esto evita un `NO_GYM` después de refrescar el access token.
    @discardableResult
    static func saveTokens(
        access: String,
        refresh: String,
        memberId member: String,
        activeGymId gymId: String? = nil
    ) -> Session {
        let resolvedGym = gymId ?? activeGymId
        write(access, accessTokenKey)
        write(refresh, refreshTokenKey)
        write(member, memberIdKey)
        if let resolvedGym, !resolvedGym.isEmpty {
            write(resolvedGym, activeGymIdKey)
        }
        return Session(
            accessToken: access,
            refreshToken: refresh,
            memberId: member,
            activeGymId: resolvedGym
        )
    }

    static func saveActiveGymId(_ gymId: String?) {
        guard let gymId, !gymId.isEmpty else {
            remove(activeGymIdKey)
            return
        }
        write(gymId, activeGymIdKey)
    }

    static func clearSession() {
        remove(accessTokenKey)
        remove(refreshTokenKey)
        remove(memberIdKey)
        remove(activeGymIdKey)
    }

    /// UUID persistido del dispositivo; se mantiene tras `clearSession()`.
    static var deviceId: String {
        if let existing = read(deviceIdKey), !existing.isEmpty {
            return existing
        }
        let generated = UUID().uuidString
        write(generated, deviceIdKey)
        return generated
    }

    // MARK: - Keychain primitives

    private static func baseQuery(_ key: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
    }

    private static func read(_ key: String) -> String? {
        var query = baseQuery(key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    @discardableResult
    private static func write(_ value: String, _ key: String) -> Bool {
        let data = Data(value.utf8)
        var query = baseQuery(key)
        query[kSecValueData as String] = data
        let addStatus = SecItemAdd(query as CFDictionary, nil)
        if addStatus == errSecSuccess { return true }
        guard addStatus == errSecDuplicateItem else { return false }
        let update: [String: Any] = [kSecValueData as String: data]
        return SecItemUpdate(baseQuery(key) as CFDictionary, update as CFDictionary) == errSecSuccess
    }

    @discardableResult
    private static func remove(_ key: String) -> Bool {
        let status = SecItemDelete(baseQuery(key) as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }
}
