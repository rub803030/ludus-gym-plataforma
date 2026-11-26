import Foundation

struct RegisterInfo {
    let email: String
    let devToken: String?
    let devLink: String?
    let expiresAt: String?
}

struct AuthRepository {
    private let api = APIClient.shared
    private let store = FileStore.shared

    func login(email: String, password: String) async throws -> Member {
        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        let response: LoginResponseDTO
        do {
            response = try await api.request(
                "api/auth/mobile/login",
                method: .post,
                body: LoginRequest(email: cleanEmail, password: password, deviceId: SecureStore.deviceId)
            )
        } catch let auth as AuthError {
            throw AuthError.emailNotVerified(email: cleanEmail)
        }

        guard let access = response.accessToken ?? response.token, !access.isEmpty else {
            throw APIError.message("El servidor no devolvió un token de acceso")
        }

        let principal = response.principal
        let memberId = principal?.identifier ?? "member-demo"
        let activeGymId = principal?.currentGymId
        SecureStore.saveTokens(
            access: access,
            refresh: response.refreshToken?.isEmpty == false ? response.refreshToken! : "refresh-\(access)",
            memberId: memberId,
            activeGymId: activeGymId
        )

        let fallback = Member(principal: principal ?? PrincipalDTO.empty, fallbackEmail: cleanEmail, fallbackId: memberId)
        if let fresh = try? await profile(fallback: fallback) {
            await store.save(fresh, key: FileStore.Key.member)
            return fresh
        }
        return fallback
    }

    func register(
        firstName: String,
        lastName: String,
        email: String,
        password: String,
        phone: String?,
        documentNumber: String?,
        birthDate: String?
    ) async throws -> RegisterInfo {
        let response: RegisterMemberResponseDTO = try await api.request(
            "api/members/register",
            method: .post,
            body: RegisterMemberRequest(
                firstName: firstName,
                lastName: lastName,
                email: email,
                password: password,
                phone: phone,
                documentNumber: documentNumber,
                birthDate: birthDate
            )
        )
        return RegisterInfo(
            email: response.verification?.email ?? response.member?.email ?? email,
            devToken: response.verification?.devToken,
            devLink: response.verification?.devLink,
            expiresAt: response.verification?.expiresAt
        )
    }

    func verifyEmail(rawToken: String) async throws -> String {
        let normalized = EnrollmentQrParser.normalize(rawToken) ?? rawToken
        let response: VerifyEmailResponseDTO = try await api.request(
            "api/auth/verify-email",
            method: .post,
            body: VerifyEmailRequest(token: normalized)
        )
        guard response.ok ?? false else {
            throw APIError.message("No fue posible confirmar el correo")
        }
        return response.email ?? ""
    }

    func resendVerification(email: String) async throws -> RegisterInfo {
        let response: ResendResponseDTO = try await api.request(
            "api/auth/verify-email/resend",
            method: .post,
            body: ResendVerificationRequest(email: email)
        )
        return RegisterInfo(email: email, devToken: response.devToken, devLink: response.devLink, expiresAt: nil)
    }

    func profile(fallback: Member? = nil) async throws -> Member {
        let memberId = SecureStore.memberId ?? fallback?.id ?? "member-demo"
        let me: MemberProfileDTO? = try? await api.request("api/auth/me")
        let dto: MemberProfileDTO? = me ?? (try? await api.request("api/members/me"))

        if let dto {
            let member = Member(dto: dto, fallbackId: memberId)
            await store.save(member, key: FileStore.Key.member)
            return member
        }
        if let cached: Member = await store.load(FileStore.Key.member) {
            return cached
        }
        if let fallback { return fallback }
        throw APIError.message("No pudimos cargar tu perfil")
    }

    func logout() async {
        await store.remove(FileStore.Key.activeGym)
        SecureStore.clearSession()
    }
}

extension PrincipalDTO {
    static var empty: PrincipalDTO {
        PrincipalDTO(
            id: nil, memberId: nil, sub: nil, email: nil, name: nil, role: nil,
            membershipStatus: nil, gymId: nil, activeGymId: nil,
            membershipEndDate: nil, planName: nil
        )
    }
}
