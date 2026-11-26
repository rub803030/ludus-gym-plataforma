import Foundation
import XCTest
@testable import LudusGYM

final class QrPayloadTests: XCTestCase {
    private func encode(_ json: String) -> String {
        Data(json.utf8)
            .base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    func testParseLiveTicket() {
        let now = QrPayload.nowMillis()
        let json = """
        {"memberId":"m1","gymId":"g1","bucket":123456,"exp":\(now + 30_000),"nonce":"abc123","signature":"\(String(repeating: "a", count: 64))"}
        """
        let parsed = QrPayload.parse(encode(json))
        XCTAssertNotNil(parsed)
        XCTAssertEqual(parsed?.memberId, "m1")
        XCTAssertEqual(parsed?.gymId, "g1")
        XCTAssertEqual(parsed?.kind, "")
        XCTAssertTrue(QrPayload.isLiveTicket(encode(json), now: now))
    }

    func testOfflineCredentialExpiryAndGym() {
        let now = QrPayload.nowMillis()
        let json = """
        {"memberId":"m1","gymId":"g2","exp":\(now + 600_000),"nonce":"abc123","kind":"offline","signature":"\(String(repeating: "b", count: 64))"}
        """
        let token = encode(json)
        let parsed = QrPayload.parse(token)
        XCTAssertEqual(parsed?.kind, "offline")
        XCTAssertEqual(parsed?.gymId, "g2")
        XCTAssertTrue(QrPayload.isOfflineCredential(token, now: now))
        XCTAssertFalse(QrPayload.isOfflineCredential(token, now: now + 601_000))
    }

    func testCachedOfflineIsFilteredByGym() {
        let now = QrPayload.nowMillis()
        let raw = encode("""
        {"memberId":"m1","gymId":"g1","exp":\(now + 600_000),"kind":"offline","signature":"\(String(repeating: "c", count: 64))"}
        """)
        let cached = CachedQrCredential(
            raw: raw,
            expiresAtMillis: now + 600_000,
            gymId: "g1",
            memberId: "m1",
            cachedAt: now
        )
        let activeGymId: String? = "g2"
        let usable = activeGymId == nil || cached.gymId == activeGymId
        XCTAssertFalse(usable)
        XCTAssertTrue(QrPayload.isOfflineCredential(cached.raw, now: now))
    }
}

final class EnrollmentQrParserTests: XCTestCase {
    private func encode(_ json: String) -> String {
        Data(json.utf8)
            .base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    func testParseSignedEnrollmentQr() {
        let token = encode("""
        {"kind":"gym-enroll","gymId":"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee","code":"LUDUS-A7K2","signature":"\(String(repeating: "d", count: 64))"}
        """)
        let parsed = EnrollmentQrParser.parse(token)
        XCTAssertEqual(parsed?.code, "LUDUS-A7K2")
        XCTAssertEqual(parsed?.gymId, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
    }

    func testParseLinkAndRejectWrongKind() {
        let token = encode("""
        {"kind":"gym-enroll","gymId":"g1","code":"LUDUS-A7K2","signature":"\(String(repeating: "e", count: 64))"}
        """)
        let link = "ludusgym://enroll?token=\(token)"
        XCTAssertNotNil(EnrollmentQrParser.parse(link))

        let wrong = encode("""
        {"kind":"offline","gymId":"g1","code":"LUDUS-A7K2","signature":"\(String(repeating: "e", count: 64))"}
        """)
        XCTAssertNil(EnrollmentQrParser.parse(wrong))
    }
}

final class ApiErrorMessagesTests: XCTestCase {
    func testCrossGymPassHasContractMessage() {
        let error = APIError.http(APIFailure(status: 403, code: "CROSS_GYM_PASS", message: "otro"))
        XCTAssertEqual(APIErrorMessages.readable(error), "Este pase pertenece a otro gimnasio")
    }

    func testKnownCodes() {
        let noGym = APIError.http(APIFailure(status: 403, code: "NO_GYM", message: nil))
        XCTAssertEqual(APIErrorMessages.readable(noGym), "Únete a un gimnasio para continuar.")

        let notVerified = AuthError.emailNotVerified(email: "a@b.com")
        XCTAssertEqual(APIErrorMessages.readable(notVerified), "Tu correo aún no está verificado. Revisa tu bandeja.")
    }

    func testUnknownMessagePassesThrough() {
        let error = APIError.http(APIFailure(status: 400, code: nil, message: "Código desconocido"))
        XCTAssertEqual(APIErrorMessages.readable(error), "Código desconocido")
    }
}

final class ContractMappingTests: XCTestCase {
    func testJoinGymDecodesNewTokensAndActiveGym() throws {
        let json = """
        {"gym":{"id":"g1","name":"GYM Norte","publicCode":"LUDUS-A7K2","status":"ACTIVE"},
         "activeGymId":"g1","alreadyMember":false,
         "tokens":{"accessToken":"access-nuevo","refreshToken":"refresh-nuevo"}}
        """
        let dto = try JSONDecoder().decode(JoinGymResponseDTO.self, from: Data(json.utf8))
        XCTAssertEqual(dto.activeGymId, "g1")
        XCTAssertEqual(dto.tokens?.accessToken, "access-nuevo")
        XCTAssertEqual(Gym(dto: dto.gym!).id, "g1")
    }

    func testSaveTokensPreservesActiveGym() {
        SecureStore.clearSession()
        let first = SecureStore.saveTokens(
            access: "a1",
            refresh: "r1",
            memberId: "m1",
            activeGymId: "g1"
        )
        XCTAssertEqual(first.activeGymId, "g1")

        let second = SecureStore.saveTokens(access: "a2", refresh: "r2", memberId: "m1")
        XCTAssertEqual(second.activeGymId, "g1")
        XCTAssertEqual(SecureStore.activeGymId, "g1")

        let deviceBefore = SecureStore.deviceId
        SecureStore.clearSession()
        XCTAssertNil(SecureStore.session)
        XCTAssertEqual(SecureStore.deviceId, deviceBefore)
    }
}

final class GymRegistrationTests: XCTestCase {
    private func validRequest(
        gymName: String = "Ludus Norte",
        email: String = "dueno@example.com",
        password: String = "ClaveSegura2026!"
    ) -> RegisterGymRequest {
        RegisterGymRequest(
            gymName: gymName,
            ownerName: "María Pérez",
            email: email,
            password: password,
            contactEmail: "contacto@example.com",
            phone: "5512345678",
            address: "Av. Insurgentes 123, Roma Norte",
            city: "Ciudad de México",
            state: "CDMX",
            postalCode: "06700",
            legalRepresentative: "María Pérez",
            rfc: "PEPM900101ABC",
            branchCount: 2
        )
    }

    func testRequestEncodesContractKeysAndMxn() throws {
        let data = try JSONEncoder().encode(validRequest())
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])

        XCTAssertEqual(json["gymName"] as? String, "Ludus Norte")
        XCTAssertEqual(json["ownerName"] as? String, "María Pérez")
        XCTAssertEqual(json["currency"] as? String, "MXN")
        XCTAssertEqual(json["branchCount"] as? Int, 2)
        XCTAssertNil(json["website"])
        XCTAssertNil(json["capacity"])
    }

    func testResponseDecodesVerificationAndApproval() throws {
        let json = """
        {"gym":{"id":"g1","name":"Ludus Norte","status":"PENDING_VERIFICATION"},
         "owner":{"email":"dueno@example.com","fullName":"María Pérez"},
         "verification":{"email":"dueno@example.com","expiresAt":"2026-12-01T00:00:00Z",
                          "devToken":"token-de-prueba","devLink":"https://example.test/verificar"},
         "approval":{"email":"admin@example.com","expiresAt":"2026-12-02T00:00:00Z",
                     "devLink":"https://example.test/autorizar"}}
        """
        let dto = try JSONDecoder().decode(RegisterGymResponseDTO.self, from: Data(json.utf8))
        XCTAssertEqual(dto.gym?.status, "PENDING_VERIFICATION")
        XCTAssertEqual(dto.owner?.fullName, "María Pérez")
        XCTAssertEqual(dto.verification?.devLink, "https://example.test/verificar")
        XCTAssertEqual(dto.approval?.email, "admin@example.com")
        XCTAssertEqual(dto.approval?.devLink, "https://example.test/autorizar")
    }

    func testValidationAcceptsValidRequest() {
        XCTAssertNil(GymRegistrationValidation.errorMessage(for: validRequest()))
    }

    func testValidationRejectsOutOfRangeFields() {
        XCTAssertNotNil(GymRegistrationValidation.errorMessage(
            for: validRequest(gymName: "L")
        ))
        XCTAssertNotNil(GymRegistrationValidation.errorMessage(
            for: validRequest(email: "correo-sin-arroba")
        ))
        XCTAssertNotNil(GymRegistrationValidation.errorMessage(
            for: validRequest(password: "corta")
        ))
        XCTAssertNotNil(GymRegistrationValidation.errorMessage(
            for: validRequest(gymName: String(repeating: "a", count: 121))
        ))
    }

    func testIntegerValidationLimits() {
        XCTAssertNil(GymRegistrationValidation.integerMessage("", label: "Sucursales", min: 1, max: 1000))
        XCTAssertNil(GymRegistrationValidation.integerMessage("2", label: "Sucursales", min: 1, max: 1000))
        XCTAssertNotNil(GymRegistrationValidation.integerMessage("abc", label: "Sucursales", min: 1))
        XCTAssertNotNil(GymRegistrationValidation.integerMessage("0", label: "Sucursales", min: 1))
        XCTAssertNotNil(GymRegistrationValidation.integerMessage("1001", label: "Sucursales", min: 1, max: 1000))
    }

    func testRegistrationErrorsAreTranslated() {
        let conflict = APIError.http(APIFailure(status: 409, code: "CONFLICT", message: "duplicado"))
        XCTAssertEqual(
            APIErrorMessages.readable(conflict),
            "Ya existe un registro con esos datos. Revisa el correo y el nombre del gimnasio."
        )
        let noAdmin = APIError.http(APIFailure(status: 503, code: "ADMIN_NOT_CONFIGURED", message: nil))
        XCTAssertEqual(
            APIErrorMessages.readable(noAdmin),
            "No hay un administrador disponible para autorizar el registro. Inténtalo más tarde."
        )
        let expired = APIError.http(APIFailure(status: 410, code: "VERIFICATION_TOKEN_EXPIRED", message: nil))
        XCTAssertEqual(
            APIErrorMessages.readable(expired),
            "El enlace de verificación expiró. Solicita uno nuevo."
        )
    }
}
