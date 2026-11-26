import Foundation
import Observation

@Observable
@MainActor
final class AppRouter {
    enum Route: Hashable {
        case login
        case registro
        case registroGimnasio
        case verificacion(token: String?)
        case vincularGimnasio
        case escanearQRGimnasio
        case misGimnasios
        case home(memberId: String, name: String)
        case qr
        case workout
        case nutrition
        case bookings
    }

    var path: [Route]
    var verificationEmail: String?
    var devLink: String?
    var memberName: String = ""

    init(deepLinkToken: String? = nil) {
        if let token = deepLinkToken, !token.isEmpty {
            path = [.verificacion(token: token)]
        } else {
            path = [Self.startDestination()]
        }
    }

    /// Prioridad: deep link → sesión con gimnasio → sesión sin gimnasio → login.
    private static func startDestination() -> Route {
        guard SecureStore.hasSession(),
              let memberId = SecureStore.memberId, !memberId.isEmpty else {
            return .login
        }
        if let gymId = SecureStore.activeGymId, !gymId.isEmpty {
            return .home(memberId: memberId, name: "")
        }
        return .vincularGimnasio
    }

    func handleDeepLink(_ url: URL) {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              components.scheme?.lowercased() == "ludusgym",
              components.host?.lowercased() == "verify-email",
              let token = components.queryItems?.first(where: { $0.name == "token" })?.value,
              !token.isEmpty else { return }
        path = [.verificacion(token: token)]
    }

    func goHome(name: String? = nil) {
        if let name { memberName = name }
        let memberId = SecureStore.memberId ?? "member-demo"
        path = [.home(memberId: memberId, name: memberName)]
    }

    func goTo(_ route: Route) {
        switch route {
        case .qr, .bookings:
            guard let gymId = SecureStore.activeGymId, !gymId.isEmpty else {
                path.append(.vincularGimnasio)
                return
            }
        default:
            break
        }
        path.append(route)
    }

    func replace(with route: Route) {
        path = [route]
    }

    func back() {
        guard !path.isEmpty else { return }
        path.removeLast()
    }

    func goToLogin() {
        path = [.login]
    }
}
