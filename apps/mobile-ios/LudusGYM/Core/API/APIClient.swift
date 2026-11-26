import Foundation

enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case delete = "DELETE"
}

/// Cliente HTTP con Bearer y refresh 401 concurrente-safe.
/// El único endpoint de refresco es `POST /api/auth/refresh`.
actor APIClient {
    static let shared = APIClient()

    static let baseURL = URL(string: "https://ludus-gym-plataforma-api.fly.dev")!

    private let session: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 10
        configuration.timeoutIntervalForResource = 10
        return URLSession(configuration: configuration)
    }()

    private let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()

    private let encoder = JSONEncoder()
    private var refreshTask: Task<TokenPairDTO, Error>?

    func request<T: Decodable>(
        _ path: String,
        method: HTTPMethod = .get,
        body: Encodable? = nil,
        authenticated: Bool = true,
        retryOn401: Bool = true
    ) async throws -> T {
        let url = Self.baseURL.appendingPathComponent(path)
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("mobile", forHTTPHeaderField: "x-platform")

        if let body {
            request.httpBody = try encoder.encode(AnyEncodable(body))
        }
        let failedToken = SecureStore.accessToken
        if authenticated, let failedToken, !failedToken.isEmpty {
            request.setValue("Bearer \(failedToken)", forHTTPHeaderField: "Authorization")
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch let error as URLError {
            throw APIError.transport(error)
        } catch {
            throw APIError.message(error.localizedDescription)
        }

        let status = (response as? HTTPURLResponse)?.statusCode ?? 0

        if status == 401 && authenticated && retryOn401 && failedToken != nil {
            try await refreshTokens()
            return try await request(
                path,
                method: method,
                body: body,
                authenticated: authenticated,
                retryOn401: false
            )
        }

        guard (200..<300).contains(status) else {
            let failure = APIErrorMessages.failure(from: data, status: status)
            if status == 403 && failure.code == "EMAIL_NOT_VERIFIED" {
                throw AuthError.emailNotVerified(email: "")
            }
            throw APIError.http(failure)
        }

        if data.isEmpty, let empty = EmptyResponse() as? T {
            return empty
        }
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decoding
        }
    }

    @discardableResult
    func requestVoid(
        _ path: String,
        method: HTTPMethod = .post,
        body: Encodable? = nil,
        authenticated: Bool = true
    ) async throws -> EmptyResponse {
        try await request(path, method: method, body: body, authenticated: authenticated)
    }

    /// Variante para respuestas `{ ok: true }` u otras sin cuerpo útil.
    func requestAny(_ path: String, method: HTTPMethod = .post, body: Encodable? = nil) async throws {
        _ = try await requestVoid(path, method: method, body: body)
    }

    // MARK: - Refresh

    private func refreshTokens() async throws {
        if let inFlight = refreshTask {
            _ = try await inFlight.value
            return
        }

        let task = Task {
            let refresh = try await performRefresh()
            return refresh
        }
        refreshTask = task
        defer { refreshTask = nil }
        _ = try await task.value
    }

    private func performRefresh() async throws -> TokenPairDTO {
        guard let refreshToken = SecureStore.refreshToken, !refreshToken.isEmpty else {
            SecureStore.clearSession()
            throw APIError.sessionExpired
        }

        do {
            let pair: RefreshResponseDTO = try await request(
                "api/auth/refresh",
                method: .post,
                body: RefreshRequest(refreshToken: refreshToken),
                authenticated: false,
                retryOn401: false
            )
            guard let access = pair.accessToken, !access.isEmpty else {
                SecureStore.clearSession()
                throw APIError.sessionExpired
            }
            // El refresh no cambia de gimnasio: se conserva el contexto activo.
            SecureStore.saveTokens(
                access: access,
                refresh: pair.refreshToken?.isEmpty == false ? pair.refreshToken! : refreshToken,
                memberId: SecureStore.memberId ?? "",
                activeGymId: SecureStore.activeGymId
            )
            return TokenPairDTO(accessToken: access, refreshToken: pair.refreshToken)
        } catch {
            SecureStore.clearSession()
            throw error
        }
    }
}

/// Permite pasar DTOs concretos como `Encodable` sin perder el tipado.
private struct AnyEncodable: Encodable {
    let value: Encodable
    init(_ value: Encodable) { self.value = value }
    func encode(to encoder: Encoder) throws { try value.encode(to: encoder) }
}
