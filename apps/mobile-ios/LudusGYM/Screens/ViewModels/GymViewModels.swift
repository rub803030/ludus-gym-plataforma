import Foundation
import Observation

@Observable
@MainActor
final class LinkGymViewModel {
    var code = ""
    var isLoading = false
    var errorMessage: String?
    var message: String?

    private let repository = GymRepository()

    @discardableResult
    func submit() async -> Bool {
        guard let token = EnrollmentQrParser.normalize(code) else {
            errorMessage = "Escribe el código del gimnasio o escanea su QR."
            return false
        }
        return await join(token: token)
    }

    @discardableResult
    func onScanned(_ raw: String) async -> Bool {
        if let parsed = EnrollmentQrParser.parse(raw) {
            code = parsed.code
            return await join(token: parsed.token)
        }
        if let token = EnrollmentQrParser.normalize(raw) {
            code = token
            return await join(token: token)
        }
        errorMessage = "No pudimos leer el QR. Prueba a escribir el código LUDUS-XXXX."
        return false
    }

    private func join(token: String) async -> Bool {
        errorMessage = nil
        isLoading = true
        defer { isLoading = false }
        do {
            let result = try await repository.join(code: token)
            message = result.alreadyMember
                ? "Ya eras socio de \(result.gym.displayName). Gimnasio activo actualizado."
                : "Vinculado con \(result.gym.displayName). Ya puedes usar tu pase QR."
            return true
        } catch {
            errorMessage = APIErrorMessages.readable(error)
            return false
        }
    }
}

@Observable
@MainActor
final class MyGymsViewModel {
    var gyms: [Gym] = []
    var activeGymId: String?
    var isLoading = false
    var switchingGymId: String?
    var errorMessage: String?
    var message: String?

    private let repository = GymRepository()

    func refresh() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let result = try await repository.myGyms()
            gyms = result.gyms
            activeGymId = result.activeGymId
        } catch {
            errorMessage = APIErrorMessages.readable(error)
            if gyms.isEmpty { gyms = await repository.cachedGyms() }
        }
    }

    @discardableResult
    func switchGym(_ gym: Gym) async -> Bool {
        guard switchingGymId == nil else { return false }
        switchingGymId = gym.id
        errorMessage = nil
        defer { switchingGymId = nil }
        do {
            let updated = try await repository.switchGym(gymId: gym.id)
            activeGymId = updated.id
            message = "Gimnasio activo: \(updated.displayName). Tokens actualizados."
            return true
        } catch {
            errorMessage = APIErrorMessages.readable(error)
            return false
        }
    }
}

@Observable
@MainActor
final class VerifyEmailViewModel {
    var token: String
    var email: String
    var code = ""
    var isLoading = false
    var message: String?
    var devLink: String?

    private let repository = AuthRepository()

    init(token: String?, email: String?) {
        self.token = token ?? ""
        self.email = email ?? ""
    }

    func prepare() {
        if !token.isEmpty {
            code = token
            message = "Te enviamos un enlace a \(email). Pégalo abajo para confirmar tu correo."
        } else if !email.isEmpty {
            message = "Tu correo no está verificado. Confirma el enlace para poder entrar."
        }
    }

    @discardableResult
    func verify() async -> Bool {
        let value = code.isEmpty ? token : code
        guard !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            message = "Pega aquí el enlace o código"
            return false
        }
        isLoading = true
        defer { isLoading = false }
        do {
            _ = try await repository.verifyEmail(rawToken: value)
            message = "Correo verificado. Inicia sesión para continuar."
            return true
        } catch {
            message = APIErrorMessages.readable(error)
            return false
        }
    }

    func resend() async {
        guard !email.isEmpty else {
            message = "Vuelve a registrarte para recibir un enlace de verificación."
            return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            let info = try await repository.resendVerification(email: email)
            devLink = info.devLink
            message = "Enviamos un nuevo enlace. Revisa tu bandeja y spam."
        } catch {
            message = APIErrorMessages.readable(error)
        }
    }
}
