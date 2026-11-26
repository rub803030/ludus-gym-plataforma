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

/// Validación pura del formulario público de registro de gimnasios.
/// Se prueba sin red desde el target de tests.
enum GymRegistrationValidation {
    private static let emailPattern = #"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"#

    static func errorMessage(for request: RegisterGymRequest) -> String? {
        guard inRange(request.gymName, 2...120) else {
            return "El nombre del gimnasio debe tener entre 2 y 120 caracteres."
        }
        if let slug = request.slug, !slug.isEmpty, slug.count > 120 {
            return "El identificador del gimnasio no puede superar 120 caracteres."
        }
        guard inRange(request.ownerName, 2...120) else {
            return "El nombre del propietario debe tener entre 2 y 120 caracteres."
        }
        guard isEmail(request.email) else {
            return "Introduce un correo electrónico válido (máximo 255 caracteres)."
        }
        guard inRange(request.password, 12...128) else {
            return "La contraseña debe tener entre 12 y 128 caracteres."
        }
        guard isEmail(request.contactEmail) else {
            return "Introduce un correo de contacto válido (máximo 255 caracteres)."
        }
        guard inRange(request.phone, 8...40) else {
            return "El teléfono debe tener entre 8 y 40 caracteres."
        }
        guard inRange(request.address, 5...200) else {
            return "La dirección debe tener entre 5 y 200 caracteres."
        }
        guard inRange(request.city, 2...80) else {
            return "La ciudad debe tener entre 2 y 80 caracteres."
        }
        guard inRange(request.state, 2...80) else {
            return "El estado debe tener entre 2 y 80 caracteres."
        }
        guard inRange(request.postalCode, 4...12) else {
            return "El código postal debe tener entre 4 y 12 caracteres."
        }
        guard inRange(request.legalRepresentative, 2...120) else {
            return "El representante legal debe tener entre 2 y 120 caracteres."
        }
        guard inRange(request.rfc, 12...13) else {
            return "El RFC debe tener entre 12 y 13 caracteres."
        }
        if let website = request.website, !website.isEmpty, !isWebsite(website) {
            return "Introduce un sitio web válido, por ejemplo https://ludusgym.com."
        }
        if let socialMedia = request.socialMedia, socialMedia.count > 300 {
            return "Las redes sociales no pueden superar 300 caracteres."
        }
        if let description = request.description, description.count > 1000 {
            return "La descripción no puede superar 1000 caracteres."
        }
        if let branchCount = request.branchCount, !(1...1000).contains(branchCount) {
            return "El número de sucursales debe estar entre 1 y 1000."
        }
        if let capacity = request.capacity, capacity < 1 {
            return "La capacidad debe ser mayor que cero."
        }
        if let openingHours = request.openingHours, openingHours.count > 200 {
            return "El horario no puede superar 200 caracteres."
        }
        return nil
    }

    /// Valida los campos numéricos antes de convertirlos a `Int`.
    static func integerMessage(_ text: String, label: String, min: Int, max: Int? = nil) -> String? {
        let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return nil }
        guard let value = Int(clean) else { return "\(label) debe ser un número entero." }
        guard value >= min else { return "\(label) debe ser al menos \(min)." }
        if let max, value > max { return "\(label) no puede superar \(max)." }
        return nil
    }

    static func optionalInt(_ text: String) -> Int? {
        let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return clean.isEmpty ? nil : Int(clean)
    }

    private static func inRange(_ value: String, _ range: ClosedRange<Int>) -> Bool {
        range.contains(value.count)
    }

    private static func isEmail(_ value: String) -> Bool {
        value.count <= 255 &&
            NSPredicate(format: "SELF MATCHES %@", emailPattern).evaluate(with: value)
    }

    private static func isWebsite(_ value: String) -> Bool {
        guard let url = URL(string: value),
              let scheme = url.scheme?.lowercased(),
              scheme == "http" || scheme == "https",
              url.host != nil else { return false }
        return true
    }
}

@Observable
@MainActor
final class RegisterGymViewModel {
    var gymName = ""
    var slug = ""
    var ownerName = ""
    var email = ""
    var password = ""
    var contactEmail = ""
    var phone = ""
    var address = ""
    var city = ""
    var state = ""
    var postalCode = ""
    var legalRepresentative = ""
    var rfc = ""
    var website = ""
    var socialMedia = ""
    var description = ""
    var branchCount = ""
    var timezone = ""
    var capacity = ""
    var openingHours = ""

    var passwordVisible = false
    var isLoading = false
    var errorMessage: String?
    var success: GymRegistrationInfo?

    private let repository = GymRepository()

    @discardableResult
    func submit() async -> Bool {
        errorMessage = nil
        if let message = GymRegistrationValidation.integerMessage(
            branchCount, label: "El número de sucursales", min: 1, max: 1000
        ) {
            errorMessage = message
            return false
        }
        if let message = GymRegistrationValidation.integerMessage(
            capacity, label: "La capacidad", min: 1
        ) {
            errorMessage = message
            return false
        }

        let request = makeRequest()
        if let message = GymRegistrationValidation.errorMessage(for: request) {
            errorMessage = message
            return false
        }

        isLoading = true
        defer { isLoading = false }
        do {
            success = try await repository.registerGym(request)
            return true
        } catch {
            errorMessage = APIErrorMessages.readable(error)
            return false
        }
    }

    func reset() {
        success = nil
        errorMessage = nil
    }

    private func makeRequest() -> RegisterGymRequest {
        func clean(_ value: String) -> String {
            value.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        func optional(_ value: String) -> String? {
            let result = clean(value)
            return result.isEmpty ? nil : result
        }
        return RegisterGymRequest(
            gymName: clean(gymName),
            ownerName: clean(ownerName),
            email: clean(email),
            password: password,
            contactEmail: clean(contactEmail),
            phone: clean(phone),
            address: clean(address),
            city: clean(city),
            state: clean(state),
            postalCode: clean(postalCode),
            legalRepresentative: clean(legalRepresentative),
            rfc: clean(rfc),
            slug: optional(slug),
            website: optional(website),
            socialMedia: optional(socialMedia),
            description: optional(description),
            branchCount: GymRegistrationValidation.optionalInt(branchCount),
            timezone: optional(timezone),
            capacity: GymRegistrationValidation.optionalInt(capacity),
            openingHours: optional(openingHours)
        )
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
