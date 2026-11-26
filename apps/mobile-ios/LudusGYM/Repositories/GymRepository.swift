import Foundation

struct JoinResult {
    let gym: Gym
    let activeGymId: String
    let alreadyMember: Bool
}

/// Resultado del registro público. Los tokens de desarrollador no se guardan
/// ni se muestran: sólo se exponen los enlaces cuando el servidor los entrega.
struct GymRegistrationInfo {
    let gymName: String
    let ownerEmail: String?
    let verificationEmail: String?
    let verificationExpiresAt: String?
    let verificationDevLink: String?
    let approvalEmail: String?
    let approvalExpiresAt: String?
    let approvalDevLink: String?
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

    /// Endpoint público: sin Bearer y sin reintento de refresco ante un 401.
    func registerGym(_ request: RegisterGymRequest) async throws -> GymRegistrationInfo {
        let response: RegisterGymResponseDTO = try await api.request(
            "api/gyms/register",
            method: .post,
            body: request,
            authenticated: false,
            retryOn401: false
        )
        return GymRegistrationInfo(
            gymName: response.gym?.name ?? request.gymName,
            ownerEmail: response.owner?.email ?? request.email,
            verificationEmail: response.verification?.email ?? request.email,
            verificationExpiresAt: response.verification?.expiresAt,
            verificationDevLink: response.verification?.devLink,
            approvalEmail: response.approval?.email,
            approvalExpiresAt: response.approval?.expiresAt,
            approvalDevLink: response.approval?.devLink
        )
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
