import Foundation

// MARK: - Socio

enum MembershipStatus: String, Codable {
    case active = "ACTIVE"
    case pending = "PENDING"
    case inactive = "INACTIVE"

    init(rawValue: String?) {
        let value = (rawValue ?? "").lowercased()
        if value.contains("pend") || value.contains("moros") || value.contains("debt") || value.contains("overdue") {
            self = .pending
        } else if value.contains("inactive") || value.contains("cancel") || value.contains("baja") {
            self = .inactive
        } else {
            self = .active
        }
    }
}

struct Member: Codable {
    let id: String
    let name: String
    let email: String
    let status: MembershipStatus
    let planName: String
    let daysRemaining: Int
    let activeGymId: String?
}

extension Member {
    init(dto: MemberProfileDTO, fallbackId: String) {
        self.init(
            id: dto.id ?? dto.memberId ?? fallbackId,
            name: dto.displayName,
            email: dto.email ?? "",
            status: MembershipStatus(rawValue: dto.statusValue),
            planName: dto.plan,
            daysRemaining: dto.days,
            activeGymId: dto.activeGymId ?? dto.gymId
        )
    }

    init(principal: PrincipalDTO, fallbackEmail: String, fallbackId: String) {
        self.init(
            id: principal.identifier ?? fallbackId,
            name: principal.name ?? fallbackEmail,
            email: principal.email ?? fallbackEmail,
            status: MembershipStatus(rawValue: principal.membershipStatus),
            planName: "Ludus Pro",
            daysRemaining: 28,
            activeGymId: principal.currentGymId
        )
    }
}

// MARK: - Gimnasio

struct Gym: Identifiable, Equatable, Codable {
    let id: String
    let name: String
    let publicCode: String?
    let status: String
    let isActive: Bool
    let joinedAt: String?

    var displayName: String { name.isEmpty ? "Gimnasio activo" : name }
}

extension Gym {
    init(dto: GymDTO) {
        self.init(
            id: dto.id ?? "",
            name: dto.name ?? "",
            publicCode: dto.publicCode,
            status: dto.status ?? "ACTIVE",
            isActive: dto.isActive ?? false,
            joinedAt: dto.joinedAt
        )
    }
}

// MARK: - Pase QR

struct QrTicket {
    let token: String
    let validUntilMillis: Int64
    let offline: Bool
    let serverExpiresAt: String?
    let gymId: String?

    func secondsRemaining(now: Int64 = Int64(Date().timeIntervalSince1970 * 1000)) -> Int {
        Int(max(0, (validUntilMillis - now) / 1000))
    }

    func isExpired(now: Int64 = Int64(Date().timeIntervalSince1970 * 1000)) -> Bool {
        now >= validUntilMillis
    }
}

// MARK: - Entrenamiento

struct Exercise: Identifiable, Equatable, Codable {
    let id: String
    let name: String
    let sets: Int
    let reps: Int
    let weightKg: Double
    let rpe: Int
    let muscleGroup: String
    let dayOfWeek: Int
}

extension Exercise {
    init(dto: ExerciseDTO, index: Int) {
        self.init(
            id: dto.id ?? "exercise-\(index)",
            name: dto.name ?? "Ejercicio \(index + 1)",
            sets: dto.sets ?? 3,
            reps: dto.reps ?? 10,
            weightKg: dto.weightKg ?? dto.weight ?? 0,
            rpe: dto.rpe ?? 7,
            muscleGroup: dto.muscleGroup ?? "General",
            dayOfWeek: dto.dayOfWeek ?? 1
        )
    }
}

struct Routine: Identifiable, Equatable, Codable {
    let id: String
    let title: String
    let dayOfWeek: Int
    let durationMinutes: Int
    let exercises: [Exercise]
}

enum RoutineMapper {
    /// La API agrupa los ejercicios dentro de una rutina semanal; el móvil
    /// muestra una tarjeta por día de la semana.
    static func routines(from dtos: [RoutineDTO]) -> [Routine] {
        var result: [String: Routine] = [:]
        for (routineIndex, dto) in dtos.enumerated() {
            let weeklyTitle = dto.title ?? dto.name ?? "Rutina del día"
            for (exerciseIndex, exerciseDTO) in (dto.exercises ?? []).enumerated() {
                let exercise = Exercise(dto: exerciseDTO, index: exerciseIndex)
                let key = "\(dto.id ?? "routine-\(routineIndex)")-\(exercise.dayOfWeek)"
                if var existing = result[key] {
                    existing.exercises.append(exercise)
                    result[key] = existing
                } else {
                    result[key] = Routine(
                        id: key,
                        title: weeklyTitle,
                        dayOfWeek: exercise.dayOfWeek,
                        durationMinutes: dto.durationMinutes ?? 60,
                        exercises: [exercise]
                    )
                }
            }
        }
        return result.values.sorted { $0.dayOfWeek < $1.dayOfWeek }
    }
}

// MARK: - Nutrición

struct Meal: Identifiable, Equatable, Codable {
    let id: String
    let name: String
    let time: String
    let calories: Int
    let proteinG: Int
    let carbsG: Int
    let fatG: Int
    let foods: [String]
}

extension Meal {
    init(dto: MealDTO, index: Int) {
        self.init(
            id: dto.id ?? "meal-\(index)",
            name: dto.name ?? dto.title ?? "Comida \(index + 1)",
            time: dto.mealTime ?? dto.time ?? "",
            calories: dto.calories ?? 0,
            proteinG: dto.proteinG ?? dto.protein ?? 0,
            carbsG: dto.carbsG ?? dto.carbs ?? 0,
            fatG: dto.fatG ?? dto.fat ?? 0,
            foods: dto.foods ?? []
        )
    }
}

struct NutritionPlan: Codable {
    let id: String
    let title: String
    let calories: Int
    let proteinG: Int
    let carbsG: Int
    let fatG: Int
    let hydrationMl: Int
    let meals: [Meal]
}

extension NutritionPlan {
    init(dto: NutritionPlanDTO) {
        self.init(
            id: dto.id ?? "nutrition-demo",
            title: dto.title ?? "Plan de nutrición",
            calories: dto.calories ?? 2400,
            proteinG: dto.proteinG ?? dto.protein ?? 180,
            carbsG: dto.carbsG ?? dto.carbs ?? 250,
            fatG: dto.fatG ?? dto.fat ?? 70,
            hydrationMl: dto.hydrationMl ?? 2500,
            meals: (dto.meals ?? []).enumerated().map { Meal(dto: $0.element, index: $0.offset) }
        )
    }
}

// MARK: - Clases y comprobantes

struct GymClass: Identifiable, Equatable, Codable {
    let id: String
    let title: String
    let startAt: String
    let durationMinutes: Int
    let coach: String
    let capacity: Int
    let booked: Int
    let isBooked: Bool
    let intensity: String

    var spotsLeft: Int { max(0, capacity - booked) }
}

extension GymClass {
    init(dto: ClassDTO, index: Int) {
        let capacity = dto.capacity ?? 16
        let taken = dto.bookedCount ?? dto.booked ?? (dto.enrolled ?? (capacity - (dto.spotsLeft ?? 0)))
        self.init(
            id: dto.id ?? "class-\(index)",
            title: dto.title ?? dto.name ?? "Clase Hyrox",
            startAt: dto.startsAt ?? dto.startAt ?? dto.time ?? "",
            durationMinutes: dto.durationMinutes ?? 60,
            coach: dto.coach ?? dto.instructor ?? "Equipo Ludus",
            capacity: capacity,
            booked: min(max(taken, 0), capacity),
            isBooked: dto.bookedByMe ?? dto.isBooked ?? false,
            intensity: dto.intensity ?? "Alta"
        )
    }
}

struct Receipt: Identifiable, Equatable, Codable {
    let id: String
    let concept: String
    let amount: Double
    let date: String
    let status: String

    var amountLabel: String {
        String(format: "%.2f MXN", locale: Locale(identifier: "es_MX"), amount)
    }
}

extension Receipt {
    init(dto: PaymentDTO, index: Int) {
        self.init(
            id: dto.id ?? "receipt-\(index)",
            concept: dto.receiptNumber ?? dto.concept ?? dto.description ?? "Membresía Ludus",
            amount: dto.amount ?? 0,
            date: dto.createdAt ?? dto.date ?? "",
            status: dto.status ?? "Pagado"
        )
    }
}

struct Occupancy: Codable {
    let current: Int
    let capacity: Int
    let updatedAt: String
}
