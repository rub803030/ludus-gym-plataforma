import Foundation

/// QR estático de inscripción (`gym-enroll`). Solo vincula la cuenta;
/// no da acceso físico. La firma se valida únicamente en el servidor.
enum EnrollmentQrParser {
    struct Parsed {
        let token: String
        let gymId: String
        let code: String
    }

    private static let maxLength = 500

    static func normalize(_ raw: String) -> String? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        var token = trimmed
        if let regex = try? NSRegularExpression(pattern: #"[?&](?:token|code)=([^&#\s]+)"#),
           let match = regex.firstMatch(in: trimmed, range: NSRange(trimmed.startIndex..., in: trimmed)),
           match.numberOfRanges > 1,
           let range = Range(match.range(at: 1), in: trimmed) {
            token = String(trimmed[range])
        }

        let decoded = token.removingPercentEncoding ?? token
        let limited = String(decoded.prefix(maxLength))
        return limited.isEmpty ? nil : limited
    }

    static func parse(_ raw: String) -> Parsed? {
        guard let token = normalize(raw),
              let json = QrPayload.decodeBase64Url(token) else { return nil }

        let kind = field("kind", in: json)
        let code = field("code", in: json)
        let gymId = field("gymId", in: json)
        let signature = field("signature", in: json)

        guard kind == "gym-enroll",
              code.count >= 4 && code.count <= 16,
              !gymId.isEmpty,
              signature.count == 64 else { return nil }

        return Parsed(token: token, gymId: gymId, code: code)
    }

    private static func field(_ name: String, in text: String) -> String {
        let pattern = #""\#(name)"\s*:\s*"([^"]*)""#
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
              match.numberOfRanges > 1,
              let range = Range(match.range(at: 1), in: text) else { return "" }
        return String(text[range])
    }
}
