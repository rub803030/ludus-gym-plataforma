import Foundation
import Observation

@Observable
@MainActor
final class LoginViewModel {
    #if DEBUG
    var email = "socio@ludusgym.com"
    var password = "Ludus2026!"
    #else
    var email = ""
    var password = ""
    #endif
    var passwordVisible = false
    var isLoading = false
    var errorMessage: String?
    var verificationMessage: String?
    var verificationDone = false
    var devLink: String?

    private let repository = AuthRepository()

    @discardableResult
    func submit() async -> Member? {
        errorMessage = nil
        guard email.contains("@") && email.count >= 5 else {
            errorMessage = "Introduce un correo electrónico válido"
            return nil
        }
        guard password.count >= 4 else {
            errorMessage = "La contraseña es demasiado corta"
            return nil
        }

        isLoading = true
        defer { isLoading = false }
        do {
            return try await repository.login(email: email, password: password)
        } catch {
            errorMessage = APIErrorMessages.readable(error)
            return nil
        }
    }

    @discardableResult
    func verify(token: String) async -> Bool {
        guard !token.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            verificationMessage = "Pega aquí el enlace o código"
            return false
        }
        verificationDone = false
        isLoading = true
        defer { isLoading = false }
        do {
            _ = try await repository.verifyEmail(rawToken: token)
            verificationMessage = "Correo verificado. Inicia sesión para continuar."
            verificationDone = true
            return true
        } catch {
            verificationMessage = APIErrorMessages.readable(error)
            return false
        }
    }

    func resend() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let info = try await repository.resendVerification(email: email)
            devLink = info.devLink
            verificationMessage = "Enviamos un nuevo enlace. Revisa tu bandeja y spam."
        } catch {
            verificationMessage = APIErrorMessages.readable(error)
        }
    }
}

@Observable
@MainActor
final class RegisterViewModel {
    var firstName = ""
    var lastName = ""
    var email = ""
    var password = ""
    var phone = ""
    var documentNumber = ""
    var birthDate = ""
    var passwordVisible = false
    var isLoading = false
    var errorMessage: String?

    private let repository = AuthRepository()

    @discardableResult
    func submit() async -> RegisterInfo? {
        errorMessage = nil
        guard firstName.count >= 2 else {
            errorMessage = "Escribe tu nombre (al menos 2 caracteres)."
            return nil
        }
        guard lastName.count >= 2 else {
            errorMessage = "Escribe tus apellidos (al menos 2 caracteres)."
            return nil
        }
        let emailPattern = #"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"#
        guard NSPredicate(format: "SELF MATCHES %@", emailPattern).evaluate(with: email) else {
            errorMessage = "Introduce un correo electrónico válido."
            return nil
        }
        guard password.count >= 12 && password.count <= 128 else {
            errorMessage = "La contraseña debe tener entre 12 y 128 caracteres."
            return nil
        }
        if !phone.isEmpty && (phone.count < 8 || phone.count > 24) {
            errorMessage = "El teléfono debe tener entre 8 y 24 caracteres."
            return nil
        }
        if !documentNumber.isEmpty && (documentNumber.count < 5 || documentNumber.count > 32) {
            errorMessage = "El documento debe tener entre 5 y 32 caracteres."
            return nil
        }
        if !birthDate.isEmpty {
            let datePattern = #"^\d{4}-\d{2}-\d{2}$"#
            guard NSPredicate(format: "SELF MATCHES %@", datePattern).evaluate(with: birthDate) else {
                errorMessage = "La fecha de nacimiento debe tener el formato AAAA-MM-DD."
                return nil
            }
        }

        isLoading = true
        defer { isLoading = false }
        do {
            return try await repository.register(
                firstName: firstName.trimmingCharacters(in: .whitespacesAndNewlines),
                lastName: lastName.trimmingCharacters(in: .whitespacesAndNewlines),
                email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                password: password,
                phone: phone.isEmpty ? nil : phone,
                documentNumber: documentNumber.isEmpty ? nil : documentNumber,
                birthDate: birthDate.isEmpty ? nil : birthDate
            )
        } catch {
            errorMessage = APIErrorMessages.readable(error)
            return nil
        }
    }
}
