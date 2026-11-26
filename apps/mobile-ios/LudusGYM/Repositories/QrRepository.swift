import Foundation

struct QrRepository {
    private let api = APIClient.shared
    private let store = FileStore.shared

    func refresh() async throws -> QrTicket {
        let activeGymId = SecureStore.activeGymId

        if await NetworkMonitor.shared.isOnline {
            do {
                return try await requestTicket(gymId: activeGymId)
            } catch let error as APIError {
                // Solo se degrada a la credencial cacheada ante fallos de red;
                // NO_GYM, CROSS_GYM_PASS, etc. deben llegar claros a la UI.
                if case .transport = error { /* continúa con la caché */ }
                else { throw error }
            }
        }

        // Sin red (o fallo de red): solo se reutiliza la credencial firmada
        // guardada si no venció y pertenece al gimnasio activo.
        let now = QrPayload.nowMillis()
        if let cached: CachedQrCredential = await store.load(FileStore.Key.qrCredential),
           cached.expiresAtMillis > now,
           QrPayload.isOfflineCredential(cached.raw, now: now),
           activeGymId == nil || cached.gymId == activeGymId {
            return QrTicket(
                token: cached.raw,
                validUntilMillis: cached.expiresAtMillis,
                offline: true,
                serverExpiresAt: nil,
                gymId: cached.gymId
            )
        }

        await store.remove(FileStore.Key.qrCredential)
        throw APIError.message("Sin conexión y sin pase offline guardado para este gimnasio")
    }

    private func requestTicket(gymId: String?) async throws -> QrTicket {
        let response: QrTokenResponseDTO = try await api.request(
            "api/access/qr-token",
            method: .post,
            body: QrTokenRequest(gymId: gymId)
        )
        guard let token = response.value else {
            throw APIError.message("El servidor no devolvió un pase")
        }

        let now = QrPayload.nowMillis()
        if let offline = response.offlineCredential,
           QrPayload.isOfflineCredential(offline, now: now),
           let parsed = QrPayload.parse(offline) {
            let credential = CachedQrCredential(
                raw: offline,
                expiresAtMillis: parsed.expiresAtMillis,
                gymId: parsed.gymId.isEmpty ? response.gymId : parsed.gymId,
                memberId: parsed.memberId.isEmpty ? (SecureStore.memberId ?? "member-demo") : parsed.memberId,
                cachedAt: now
            )
            await store.save(credential, key: FileStore.Key.qrCredential)
        }

        let gym = response.gymId?.isEmpty == false
            ? response.gymId
            : (QrPayload.parse(token)?.gymId ?? gymId)

        return QrTicket(
            token: token,
            validUntilMillis: expiryMillis(response: response, now: now),
            offline: false,
            serverExpiresAt: response.expiresAt,
            gymId: gym
        )
    }

    private func expiryMillis(response: QrTokenResponseDTO, now: Int64) -> Int64 {
        if let expiresAt = response.expiresAt,
           let date = Self.parseISO(expiresAt) {
            return Int64(date.timeIntervalSince1970 * 1000)
        }
        let seconds = response.expiresIn ?? response.validForSeconds ?? 30
        return now + min(max(seconds, 1), 3600) * 1000
    }

    private static func parseISO(_ value: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: value) { return date }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value)
    }
}
