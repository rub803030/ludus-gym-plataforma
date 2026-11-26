import Foundation

/// Parseo del pase firmado por el servidor. El móvil nunca conoce el secreto
/// HMAC ni vuelve a firmar: la validación final siempre la hace `/verify-qr`.
enum QrPayload {
    static let offlineValidSeconds: Int64 = 600

    struct Parsed {
        let raw: String
        let memberId: String
        let gymId: String
        let expiresAtMillis: Int64
        let kind: String
    }

    static func parse(_ raw: String) -> Parsed? {
        guard let json = decodeBase64Url(raw) else { return nil }

        let expPattern = #""exp"\s*:\s*(-?\d+)"#
        guard let expMatch = firstMatch(expPattern, in: json),
              let exp = Int64(expMatch), exp > 0 else { return nil }

        return Parsed(
            raw: raw,
            memberId: stringField("memberId", in: json),
            gymId: stringField("gymId", in: json),
            expiresAtMillis: exp,
            kind: stringField("kind", in: json)
        )
    }

    static func isOfflineCredential(_ raw: String, now: Int64 = nowMillis()) -> Bool {
        guard let parsed = parse(raw) else { return false }
        return parsed.kind == "offline" && parsed.expiresAtMillis > now
    }

    static func isLiveTicket(_ raw: String, now: Int64 = nowMillis()) -> Bool {
        guard let parsed = parse(raw) else { return false }
        return parsed.kind.isEmpty && parsed.expiresAtMillis > now
    }

    static func nowMillis() -> Int64 {
        Int64(Date().timeIntervalSince1970 * 1000)
    }

    // MARK: - Helpers

    static func decodeBase64Url(_ value: String) -> String? {
        var normalized = value
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let remainder = normalized.count % 4
        switch remainder {
        case 0: break
        case 2: normalized += "=="
        case 3: normalized += "="
        default: return nil
        }
        guard let data = Data(base64Encoded: normalized) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private static func stringField(_ name: String, in text: String) -> String {
        let pattern = #""\#(name)"\s*:\s*"([^"]*)""#
        return firstMatch(pattern, in: text) ?? ""
    }

    private static func firstMatch(_ pattern: String, in text: String) -> String? {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }
        let range = NSRange(text.startIndex..., in: text)
        guard let match = regex.firstMatch(in: text, range: range),
              match.numberOfRanges > 1,
              let captured = Range(match.range(at: 1), in: text) else { return nil }
        return String(text[captured])
    }
}
