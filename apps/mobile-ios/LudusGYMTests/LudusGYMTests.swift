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
