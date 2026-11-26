import Foundation

struct APIFailure {
    let status: Int
    let code: String?
    let message: String?
}

enum APIError: Error, LocalizedError {
    case http(APIFailure)
    case transport(URLError)
    case decoding
    case invalidResponse
    case sessionExpired
    case message(String)

    var failure: APIFailure? {
        if case .http(let failure) = self { return failure }
        return nil
    }

    var errorDescription: String? { APIErrorMessages.readable(self) }
}

enum AuthError: Error, LocalizedError {
    case emailNotVerified(email: String)
    case invalidCredentials

    var errorDescription: String? { APIErrorMessages.readable(self) }
}

/// Traducciones de errores de la API. El orden de precedencia replica
/// `ApiErrorMessages.kt` de la app Android.
enum APIErrorMessages {
    static let crossGymMessage = "Este pase pertenece a otro gimnasio"

    static func code(_ error: Error) -> String? {
        if let api = error as? APIError, let code = api.failure?.code { return code }
        if error is AuthError { return "EMAIL_NOT_VERIFIED" }
        if let api = error as? APIError, case .transport = api { return "IO_ERROR" }
        return nil
    }

    static func readable(_ error: Error) -> String {
        let code = code(error)
        let serverMessage = (error as? APIError)?.failure?.message ?? ""

        if code == "CROSS_GYM_PASS" ||
            serverMessage.localizedCaseInsensitiveContains(crossGymMessage) {
            return crossGymMessage
        }
        if let api = error as? APIError, case .transport = api {
            return "Sin conexión. Revisa tu red e inténtalo de nuevo."
        }
        if let auth = error as? AuthError, case .emailNotVerified = auth {
            return "Tu correo aún no está verificado. Revisa tu bandeja."
        }
        switch code {
        case "NO_GYM":
            return "Únete a un gimnasio para continuar."
        case "EMAIL_NOT_VERIFIED":
            return "Tu correo aún no está verificado. Revisa tu bandeja."
        case "GYM_NOT_ACTIVE":
            return "Este gimnasio todavía no está activo."
        case "CONFLICT":
            return "Ya existe un registro con esos datos. Revisa el correo y el nombre del gimnasio."
        case "ADMIN_NOT_CONFIGURED":
            return "No hay un administrador disponible para autorizar el registro. Inténtalo más tarde."
        case "VERIFICATION_TOKEN_INVALID":
            return "El enlace de verificación no es válido. Solicita uno nuevo."
        case "VERIFICATION_TOKEN_EXPIRED":
            return "El enlace de verificación expiró. Solicita uno nuevo."
        case "VALIDATION_ERROR":
            return serverMessage.isEmpty ? "Revisa los datos introducidos." : serverMessage
        case "IO_ERROR":
            return "Sin conexión. Revisa tu red e inténtalo de nuevo."
        default:
            if !serverMessage.isEmpty { return serverMessage }
            if let api = error as? APIError, case .message(let text) = api, !text.isEmpty {
                return text
            }
            return "No pudimos completar la operación. Inténtalo de nuevo."
        }
    }

    /// Parsea `{ "error": { "code": ..., "message": ... } }`.
    static func failure(from data: Data, status: Int) -> APIFailure {
        struct Envelope: Decodable {
            let error: Body?
        }
        struct Body: Decodable {
            let code: String?
            let message: String?
        }

        let decoder = JSONDecoder()
        if let envelope = try? decoder.decode(Envelope.self, from: data),
           let body = envelope.error {
            return APIFailure(status: status, code: body.code, message: body.message)
        }

        // Los errores de validación de Zod pueden traer `details` con tipos
        // heterogéneos; el envelope anterior basta para code/message. Como
        // respaldo buscamos los códigos conocidos en el texto crudo.
        let text = String(data: data, encoding: .utf8) ?? ""
        let known = ["CROSS_GYM_PASS", "NO_GYM", "GYM_NOT_ACTIVE", "EMAIL_NOT_VERIFIED",
                     "IDEMPOTENCY_REPLAY", "CONFLICT", "VALIDATION_ERROR", "UNAUTHORIZED",
                     "RATE_LIMITED", "NOT_FOUND", "FORBIDDEN", "ADMIN_NOT_CONFIGURED",
                     "VERIFICATION_TOKEN_INVALID", "VERIFICATION_TOKEN_EXPIRED"]
        let found = known.first { text.range(of: $0) != nil }
        return APIFailure(status: status, code: found, message: text.isEmpty ? nil : text)
    }
}
