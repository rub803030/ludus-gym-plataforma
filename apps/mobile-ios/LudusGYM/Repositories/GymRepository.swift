import Foundation

struct JoinResult {
    let gym: Gym
    let activeGymId: String
    let alreadyMember: Bool
}

struct GymRepository {
    private let api = APIClient.shared
    private let store = FileStore.shared

    /// Guarda los tokens nuevos ANTES de navegar: el JWT anterior todavía no
    /// incluye el gimnasio recién vinculado.
    func join(code: String) async throws -> JoinResult {
        let response: JoinGymResponseDTO = try await api.request(
            "api/members/join-gym",
            method: .post,
            body: JoinGymRequest(code: code)
        )
        guard let dto = response.gym, let gymId = response.activeGymId ?? dto.id, !gymId.isEmpty else {
            throw APIError.message("El servidor no devolvió el gimnasio")
        }
        let gym = Gym(dto: dto)
        apply(tokens: response.tokens, gymId: gymId)
        await cache(gym: gym, activeGymId: gymId)
        return JoinResult(gym: gym, activeGymId: gymId, alreadyMember: response.alreadyMember ?? false)
    }

    func switchGym(gymId: String) async throws -> Gym {
        let response: SwitchGymResponseDTO = try await api.request(
            "api/members/switch-gym",
            method: .post,
            body: SwitchGymRequest(gymId: gymId)
        )
        guard let dto = response.gym else {
            throw APIError.message("El servidor no devolvió el gimnasio")
        }
        let resolvedId = response.activeGymId ?? dto.id ?? gymId
        let gym = Gym(dto: dto)
        apply(tokens: response.tokens, gymId: resolvedId)
        await cache(gym: gym, activeGymId: resolvedId)
        return gym
    }

    func myGyms() async throws -> (activeGymId: String?, gyms: [Gym]) {
        let response: MyGymsResponseDTO = try await api.request("api/members/my-gyms")
        let gyms = (response.gyms ?? []).map(Gym.init(dto:))
        SecureStore.saveActiveGymId(response.activeGymId)
        await store.save(gyms, key: FileStore.Key.gyms)
        return (response.activeGymId, gyms)
    }

    func cachedGyms() async -> [Gym] {
        await store.load(FileStore.Key.gyms) ?? []
    }

    // MARK: - Privado

    private func apply(tokens: TokenPairDTO?, gymId: String) {
        guard let tokens, let access = tokens.accessToken, !access.isEmpty else { return }
        SecureStore.saveTokens(
            access: access,
            refresh: tokens.refreshToken?.isEmpty == false ? tokens.refreshToken! : (SecureStore.refreshToken ?? ""),
            memberId: SecureStore.memberId ?? "",
            activeGymId: gymId
        )
    }

    private func cache(gym: Gym, activeGymId: String) async {
        var gyms: [Gym] = await store.load(FileStore.Key.gyms) ?? []
        if let index = gyms.firstIndex(where: { $0.id == gym.id }) {
            gyms[index] = gym
        } else {
            gyms.append(gym)
        }
        await store.save(gyms, key: FileStore.Key.gyms)
        await store.save(activeGymId, key: FileStore.Key.activeGym)
    }
}
