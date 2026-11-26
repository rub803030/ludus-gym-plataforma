import Foundation

// MARK: - Autenticación

struct LoginRequest: Encodable {
    let email: String
    let password: String
    let platform: String
    let deviceId: String?

    init(email: String, password: String, deviceId: String? = nil) {
        self.email = email
        self.password = password
        self.platform = "mobile"
        self.deviceId = deviceId
    }
}

struct PrincipalDTO: Decodable {
    let id: String?
    let memberId: String?
    let sub: String?
    let email: String?
    let name: String?
    let role: String?
    let membershipStatus: String?
    let gymId: String?
    let activeGymId: String?
    let membershipEndDate: String?
    let planName: String?

    var identifier: String? { memberId ?? id ?? sub }
    var currentGymId: String? { activeGymId ?? gymId }
}

struct TokenPairDTO: Codable {
    let accessToken: String?
    let refreshToken: String?
}

struct LoginResponseDTO: Decodable {
    let accessToken: String?
    let refreshToken: String?
    let token: String?
    let principal: PrincipalDTO?
}

struct RefreshRequest: Encodable {
    let refreshToken: String
}

struct RefreshResponseDTO: Decodable {
    let accessToken: String?
    let refreshToken: String?
    let principal: PrincipalDTO?
}

struct VerifyEmailRequest: Encodable {
    let token: String
}

struct VerifyEmailResponseDTO: Decodable {
    let ok: Bool?
    let email: String?
    let platform: String?
    let name: String?
}

struct ResendVerificationRequest: Encodable {
    let email: String
    let platform: String

    init(email: String) {
        self.email = email
        self.platform = "mobile"
    }
}

struct ResendResponseDTO: Decodable {
    let ok: Bool?
    let devToken: String?
    let devLink: String?
}

struct RegisterMemberRequest: Encodable {
    let firstName: String
    let lastName: String
    let email: String
    let password: String
    let phone: String?
    let documentNumber: String?
    let birthDate: String?
}

struct RegisteredMemberDTO: Decodable {
    let id: String?
    let code: String?
    let email: String?
}

struct VerificationIssueDTO: Decodable {
    let email: String?
    let expiresAt: String?
    let devToken: String?
    let devLink: String?
}

struct RegisterMemberResponseDTO: Decodable {
    let member: RegisteredMemberDTO?
    let verification: VerificationIssueDTO?
}

struct MemberProfileDTO: Decodable {
    let id: String?
    let memberId: String?
    let code: String?
    let name: String?
    let firstName: String?
    let lastName: String?
    let email: String?
    let phone: String?
    let status: String?
    let membershipStatus: String?
    let joinedAt: String?
    let daysRemaining: Int?
    let membership: MembershipDTO?
    let nutritionPlan: NutritionPlanDTO?
    let activeGymId: String?
    let gymId: String?

    var displayName: String {
        let full = [firstName, lastName].compactMap { $0 }.joined(separator: " ")
        return name ?? (full.isEmpty ? nil : full) ?? email ?? "Socio Ludus"
    }

    var statusValue: String {
        membership?.status ?? membershipStatus ?? status ?? "ACTIVE"
    }

    var plan: String { membership?.planName ?? "Ludus Pro" }

    var days: Int { daysRemaining ?? 28 }
}

struct MembershipDTO: Decodable {
    let planName: String?
    let endDate: String?
    let status: String?
}

struct EmptyResponse: Decodable {}

// MARK: - Gimnasios

struct GymDTO: Decodable {
    let id: String?
    let name: String?
    let publicCode: String?
    let status: String?
    let isActive: Bool?
    let joinedAt: String?
}

/// Registro público de un gimnasio. No requiere sesión ni rol de socio.
struct RegisterGymRequest: Encodable {
    let gymName: String
    let slug: String?
    let ownerName: String
    let email: String
    let password: String
    let contactEmail: String
    let phone: String
    let address: String
    let city: String
    let state: String
    let postalCode: String
    let legalRepresentative: String
    let rfc: String
    let website: String?
    let socialMedia: String?
    let description: String?
    let branchCount: Int?
    let timezone: String?
    let capacity: Int?
    let currency: String
    let openingHours: String?

    init(
        gymName: String,
        ownerName: String,
        email: String,
        password: String,
        contactEmail: String,
        phone: String,
        address: String,
        city: String,
        state: String,
        postalCode: String,
        legalRepresentative: String,
        rfc: String,
        slug: String? = nil,
        website: String? = nil,
        socialMedia: String? = nil,
        description: String? = nil,
        branchCount: Int? = nil,
        timezone: String? = nil,
        capacity: Int? = nil,
        openingHours: String? = nil
    ) {
        self.gymName = gymName
        self.slug = slug
        self.ownerName = ownerName
        self.email = email
        self.password = password
        self.contactEmail = contactEmail
        self.phone = phone
        self.address = address
        self.city = city
        self.state = state
        self.postalCode = postalCode
        self.legalRepresentative = legalRepresentative
        self.rfc = rfc
        self.website = website
        self.socialMedia = socialMedia
        self.description = description
        self.branchCount = branchCount
        self.timezone = timezone
        self.capacity = capacity
        self.currency = "MXN"
        self.openingHours = openingHours
    }
}

struct RegisteredGymDTO: Decodable {
    let id: String?
    let name: String?
    let slug: String?
    let status: String?
    let publicCode: String?
}

struct GymOwnerDTO: Decodable {
    let email: String?
    let fullName: String?
}

struct RegisterGymResponseDTO: Decodable {
    let gym: RegisteredGymDTO?
    let owner: GymOwnerDTO?
    let verification: VerificationIssueDTO?
    let approval: VerificationIssueDTO?
}

struct JoinGymRequest: Encodable {
    let code: String
}

struct JoinGymResponseDTO: Decodable {
    let gym: GymDTO?
    let activeGymId: String?
    let alreadyMember: Bool?
    let tokens: TokenPairDTO?
}

struct SwitchGymRequest: Encodable {
    let gymId: String
}

struct SwitchGymResponseDTO: Decodable {
    let gym: GymDTO?
    let activeGymId: String?
    let tokens: TokenPairDTO?
}

struct MyGymsResponseDTO: Decodable {
    let activeGymId: String?
    let gyms: [GymDTO]?
}

// MARK: - Acceso

struct QrTokenRequest: Encodable {
    let gymId: String?
}

struct QrTokenResponseDTO: Decodable {
    let token: String?
    let qrToken: String?
    let bucket: Int64?
    let expiresAt: String?
    let expiresIn: Int64?
    let validForSeconds: Int64?
    let offlineCredential: String?
    let gymId: String?

    var value: String? {
        let candidate = token ?? qrToken
        return candidate?.isEmpty == false ? candidate : nil
    }
}

// MARK: - Entrenamiento

struct ExerciseDTO: Decodable {
    let id: String?
    let name: String?
    let dayOfWeek: Int?
    let sets: Int?
    let reps: Int?
    let restSeconds: Int?
    let weightKg: Double?
    let weight: Double?
    let rpe: Int?
    let muscleGroup: String?
}

struct RoutineDTO: Decodable {
    let id: String?
    let title: String?
    let name: String?
    let weekStart: String?
    let notes: String?
    let dayOfWeek: Int?
    let durationMinutes: Int?
    let exercises: [ExerciseDTO]?
}

struct WorkoutLogRequest: Encodable {
    let exerciseId: String
    let weightKg: Double
    let repsDone: Int
    let rpe: Int
    let performedAt: String
    let sets: Int?
}

struct WorkoutLogResponseDTO: Decodable {
    let id: String?
    let performedAt: String?
}

// MARK: - Nutrición

struct MealDTO: Decodable {
    let id: String?
    let name: String?
    let title: String?
    let mealTime: String?
    let time: String?
    let calories: Int?
    let proteinG: Int?
    let protein: Int?
    let carbsG: Int?
    let carbs: Int?
    let fatG: Int?
    let fat: Int?
    let foods: [String]?
}

struct NutritionPlanDTO: Decodable {
    let id: String?
    let title: String?
    let calories: Int?
    let proteinG: Int?
    let protein: Int?
    let carbsG: Int?
    let carbs: Int?
    let fatG: Int?
    let fat: Int?
    let hydrationMl: Int?
    let meals: [MealDTO]?
}

// MARK: - Clases y pagos

struct ClassDTO: Decodable {
    let id: String?
    let title: String?
    let name: String?
    let startsAt: String?
    let startAt: String?
    let time: String?
    let durationMinutes: Int?
    let coach: String?
    let instructor: String?
    let capacity: Int?
    let bookedCount: Int?
    let booked: Int?
    let enrolled: Int?
    let spotsLeft: Int?
    let bookedByMe: Bool?
    let isBooked: Bool?
    let intensity: String?
}

struct BookingResponseDTO: Decodable {
    let ok: Bool?
    let booked: Bool?
    let bookingId: String?
    let success: Bool?
}

struct PaymentDTO: Decodable {
    let id: String?
    let receiptNumber: String?
    let concept: String?
    let description: String?
    let amount: Double?
    let date: String?
    let createdAt: String?
    let status: String?
}
